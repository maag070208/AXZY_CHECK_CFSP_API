-- Drop old foreign keys
ALTER TABLE "GuardDiscipline" DROP CONSTRAINT IF EXISTS "GuardDiscipline_categoryId_fkey";
ALTER TABLE "GuardDiscipline" DROP CONSTRAINT IF EXISTS "GuardDiscipline_typeId_fkey";

-- Drop old tables
DROP TABLE IF EXISTS "DisciplineType" CASCADE;
DROP TABLE IF EXISTS "DisciplineCategory" CASCADE;

-- Add new foreign keys referencing IncidentCategory / IncidentType
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_categoryId_fkey" 
  FOREIGN KEY ("categoryId") REFERENCES "IncidentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "IncidentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
