import { ITDataTableFetchParams } from "../dto/datatable.dto";

/**
 * Converts ITDataTableFetchParams into Prisma query options.
 * Handles pagination (skip/take), sorting (orderBy), and filtering (where).
 */
export function getPrismaPaginationParams(params: ITDataTableFetchParams) {
  const { page = 1, limit = 10, filters = {}, sort } = params || {};

  // Pagination
  const take = Number(limit) || 10;
  const skip = (Math.max(1, Number(page)) - 1) * take;

  // Sorting
  const orderBy = sort?.key
    ? { [sort.key]: sort.direction || "asc" }
    : { createdAt: "desc" as const }; // Default sort

  // Filtering
  const where: any = {};
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "" || key === "refreshKey") return;

      // String filtering
      if (typeof value === "string") {
        // If it's an ID field, try to parse it as a number for exact match
        if (key.toLowerCase().endsWith('id')) {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            where[key] = numValue;
            return;
          }
        }

        // Enums and Status must be exact match (Prisma doesn't support 'contains' on enums)
        const isStatusOrRole = ["status", "role", "type", "category"].includes(key.toLowerCase());
        const isEnumPattern = /^[A-Z_]+$/.test(value); 

        if (isStatusOrRole && isEnumPattern) {
            where[key] = value;
            return;
        }

        // Default string search: contains + insensitive
        where[key] = {
          contains: value,
          mode: "insensitive",
        };
      } 
      // Boolean and Number: exact match
      else {
        where[key] = value;
      }
    });
  }

  return {
    skip,
    take,
    where,
    orderBy,
  };
}
