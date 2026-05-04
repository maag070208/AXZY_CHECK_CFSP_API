import { prismaClient } from "@src/core/config/database";
import { AssignmentStatus, ScanType } from "@prisma/client";
import { ASSIGNMENT_STATUS_PENDING, ROUND_STATUS_IN_PROGRESS } from "@src/core/config/constants";

// New Core Logic: Register Check with Automatic Classification
export const registerCheck = async (data: {
  userId: string;
  locationId: string;
  notes?: string;
  media?: any[];
  latitude?: number;
  longitude?: number;
  assignmentId?: string; // Optional manual override
}) => {
  let finalScanType: ScanType = ScanType.FREE;
  let finalAssignmentId: string | undefined | null = data.assignmentId;

  // 1. Check for Active Assignment (Highest Priority)
  // We check if there is a PENDING/CHECKING assignment for this user & location
  // If data.assignmentId is provided, we trust it, otherwise we try to find one.
  const activeAssignment = await prismaClient.assignment.findFirst({
    where: {
      guardId: data.userId,
      locationId: data.locationId,
      status: {
        in: [
          AssignmentStatus.PENDING,
          AssignmentStatus.CHECKING,
          AssignmentStatus.UNDER_REVIEW,
          AssignmentStatus.ANOMALY,
        ],
      },
    },
  });

  if (activeAssignment) {
    finalScanType = ScanType.ASSIGNMENT;
    finalAssignmentId = activeAssignment.id; // Link to the found assignment

    // Update Assignment status to CHECKING if it was PENDING
    if (activeAssignment.status === AssignmentStatus.PENDING) {
      await prismaClient.assignment.update({
        where: { id: activeAssignment.id },
        data: { status: AssignmentStatus.CHECKING },
      });
    }
  } else {
    // 2. Check for Active Round (Medium Priority)
    const activeRound = await prismaClient.round.findFirst({
      where: { guardId: data.userId, status: ROUND_STATUS_IN_PROGRESS },
      include: {
        client: { include: { locations: true } },
        recurringConfiguration: { include: { recurringLocations: true } },
      },
    });

    const isPartOfClient = activeRound?.client?.locations.some(
      (l: any) => l.id === data.locationId,
    );
    const isPartOfRecurring =
      activeRound?.recurringConfiguration?.recurringLocations.some(
        (rl: any) => rl.locationId === data.locationId,
      );

    if (isPartOfClient || isPartOfRecurring) {
      finalScanType = ScanType.RECURRING;
      finalAssignmentId = undefined; // Ensure no assignment link for recurring
    } else {
      // 3. Fallback to FREE
      finalScanType = ScanType.FREE;
      finalAssignmentId = undefined;
    }
  }

  // Create the Kardex Record
  return prismaClient.kardex.create({
    data: {
      userId: data.userId,
      locationId: data.locationId,
      notes: data.notes,
      media: data.media,
      latitude: data.latitude,
      longitude: data.longitude,
      assignmentId: finalAssignmentId,
      scanType: finalScanType,
    },
  });
};

// Deprecated or Internal Use
export const createKardex = registerCheck;

export const updateKardex = async (
  id: string,
  data: {
    notes?: string;
    media?: any[];
    latitude?: number;
    longitude?: number;
  },
) => {
  return prismaClient.kardex.update({
    where: { id },
    data,
  });
};

export const getKardex = async (filters: {
  userId?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const where: any = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.locationId) where.locationId = filters.locationId;

  if (filters.startDate && filters.endDate) {
    where.timestamp = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    };
  }

  return prismaClient.kardex.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          username: true,
          role: true,
        },
      },
      location: true,
      assignment: {
        include: {
          tasks: true,
        },
      },
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

export const getKardexById = async (id: string) => {
  const kardex = await prismaClient.kardex.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          username: true,
          role: true,
        },
      },
      location: true,
      assignment: {
        include: {
          tasks: true,
        },
      },
    },
  });

  if (kardex && !kardex.assignment && kardex.scanType === "RECURRING") {
    const locationWithTasks = await prismaClient.location.findUnique({
      where: { id: kardex.locationId },
      include: { tasks: true },
    });

    if (locationWithTasks && locationWithTasks.tasks.length > 0) {
      // Temporarily attach these tasks as if they were assignment tasks (read-only view)
      return {
        ...kardex,
        assignment: {
          // Mock an assignment object structure for compatibility
          id: "0",
          tasks: locationWithTasks.tasks.map((t: any) => ({
            id: t.id,
            description: t.description,
            completed: false, // Default to false since we don't know
            reqPhoto: t.reqPhoto,
          })),
          status: ASSIGNMENT_STATUS_PENDING,
        },
      };
    }
  }

  return kardex;
};

export const getDataTableKardex = async (params: {
  page: number;
  limit: number;
  filters: any;
  sort?: { key: string; order: "asc" | "desc" };
}) => {
  const { page, limit, filters, sort } = params;
  const skip = (page - 1) * limit;
  const take = limit;

  const where: any = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.search) {
    where.user = {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  if (filters.date && Array.isArray(filters.date) && filters.date[0]) {
    const start = new Date(filters.date[0]);
    const end = filters.date[1] ? new Date(filters.date[1]) : new Date(start);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      where.timestamp = {
        gte: start,
        lte: end,
      };
    }
  }

  const orderBy: any = {};
  if (sort && sort.key) {
    // Basic mapping for related fields if needed
    if (sort.key === "user") {
      orderBy.user = { name: sort.order };
    } else if (sort.key === "location") {
      orderBy.location = { name: sort.order };
    } else {
      orderBy[sort.key] = sort.order;
    }
  } else {
    orderBy.timestamp = "desc";
  }

  const [rows, total] = await Promise.all([
    prismaClient.kardex.findMany({
      skip,
      take,
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            username: true,
            role: true,
          },
        },
        location: true,
        assignment: true,
      },
      orderBy,
    }),
    prismaClient.kardex.count({ where }),
  ]);

  return {
    data: rows,
    total,
  };
};

export const deleteKardex = async (id: string) => {
  return prismaClient.kardex.delete({
    where: { id },
  });
};

export const updateKardexMedia = async (id: string, media: any[]) => {
  return prismaClient.kardex.update({
    where: { id },
    data: { media },
  });
};
