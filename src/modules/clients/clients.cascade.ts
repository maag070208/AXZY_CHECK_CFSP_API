import { ROLE_CLIENT } from "@src/core/config/constants";

/**
 * Handles cascade deletion of client-related data.
 * Used by both clients.service and user.service when a client-owner is deleted.
 */
export async function deleteClientDataCascade(tx: any, clientId: string, userIdToExclude?: string) {
  // 1. Unassign guards (don't delete them, just set clientId to null)
  const roleClient = await tx.role.findUnique({ where: { name: ROLE_CLIENT } });
  
  const unassignWhere: any = { clientId };
  if (userIdToExclude) {
    unassignWhere.id = { not: userIdToExclude };
  }
  unassignWhere.roleId = { not: roleClient?.id };

  await tx.user.updateMany({
    where: unassignWhere,
    data: { clientId: null }
  });

  // 2. Physical delete all users that ARE client users
  const deleteUsersWhere: any = { clientId, roleId: roleClient?.id };
  if (userIdToExclude) {
    deleteUsersWhere.id = { not: userIdToExclude };
  }
  await tx.user.deleteMany({
    where: deleteUsersWhere
  });

  // 3. Recurring Configurations
  const configs = await tx.recurringConfiguration.findMany({
    where: { clientId },
    select: { id: true },
  });
  const configIds = configs.map((c: any) => c.id);

  if (configIds.length > 0) {
    const recurringLocs = await tx.recurringLocation.findMany({
      where: { recurringConfigurationId: { in: configIds } },
      select: { id: true },
    });
    const recLocIds = recurringLocs.map((rl: any) => rl.id);

    if (recLocIds.length > 0) {
      await tx.recurringTask.deleteMany({
        where: { recurringLocationId: { in: recLocIds } },
      });
    }

    await tx.recurringLocation.deleteMany({
      where: { recurringConfigurationId: { in: configIds } },
    });
  }

  // 4. Locations and related
  const locations = await tx.location.findMany({
    where: { clientId },
    select: { id: true },
  });
  const locationIds = locations.map((l: any) => l.id);

  if (locationIds.length > 0) {
    await tx.recurringLocation.deleteMany({ where: { locationId: { in: locationIds } } });
    await tx.locationTask.deleteMany({ where: { locationId: { in: locationIds } } });

    const assignments = await tx.assignment.findMany({
      where: { locationId: { in: locationIds } },
      select: { id: true }
    });
    const assignIds = assignments.map((a: any) => a.id);
    if (assignIds.length > 0) {
      await tx.assignmentTask.deleteMany({ where: { assignmentId: { in: assignIds } } });
    }
    await tx.assignment.deleteMany({ where: { locationId: { in: locationIds } } });
    await tx.kardex.deleteMany({ where: { locationId: { in: locationIds } } });
  }

  // 5. General entities
  await tx.round.deleteMany({ where: { clientId } });
  await tx.incident.deleteMany({ where: { clientId } });
  await tx.maintenance.deleteMany({ where: { clientId } });
  await tx.recurringConfiguration.deleteMany({ where: { clientId } });
  await tx.zone.deleteMany({ where: { clientId } });
  
  // 6. Data associated with users of this client (guards/staff)
  const clientUsers = await tx.user.findMany({
    where: { clientId },
    select: { id: true },
  });
  const clientUserIds = clientUsers.map((u: any) => u.id);

  if (clientUserIds.length > 0) {
    const userAssignments = await tx.assignment.findMany({
      where: { guardId: { in: clientUserIds } },
      select: { id: true },
    });
    const userAssignIds = userAssignments.map((a: any) => a.id);
    if (userAssignIds.length > 0) {
      await tx.assignmentTask.deleteMany({
        where: { assignmentId: { in: userAssignIds } },
      });
    }
    await tx.assignment.deleteMany({
      where: { guardId: { in: clientUserIds } },
    });

    await tx.kardex.deleteMany({ where: { userId: { in: clientUserIds } } });
    await tx.round.deleteMany({ where: { guardId: { in: clientUserIds } } });
    await tx.incident.deleteMany({
      where: {
        OR: [
          { guardId: { in: clientUserIds } },
          { resolvedById: { in: clientUserIds } },
        ],
      },
    });
    await tx.maintenance.deleteMany({
      where: {
        OR: [
          { guardId: { in: clientUserIds } },
          { resolvedById: { in: clientUserIds } },
        ],
      },
    });
  }

  // Finally delete locations
  await tx.location.deleteMany({ where: { clientId } });
}
