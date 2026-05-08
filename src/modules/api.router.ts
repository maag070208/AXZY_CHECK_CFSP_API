import { Router } from "express";

import indexRoute from "./index.routes";
import userRoute from "./users/user.routes";
import locationsRoute from "./locations/locations.routes";
import uploadRoute from "./common/upload.routes";
import kardexRoute from "./kardex/kardex.routes";
import assignmentsRoute from "./assignments/assignment.routes";
import incidentRoute from "./incidents/incident.routes";
import roundRoute from "./rounds/round.routes";
import scheduleRoute from "./schedules/schedule.routes";
import maintenanceRoute from "./maintenance/maintenance.routes";
import reportRoute from "./reports/report.routes";
import catalogRoute from "./catalog/catalog.routes";
import clientsRoute from "./clients/clients.routes";
import zonesRoute from "./zones/zones.routes";
import recurringRoute from "./recurring/recurring.routes";
import settingsRoute from "./settings/settings.routes";
import syncRoute from "./sync/sync.routes";
import homeRoute from "./home/home.routes";

const apiRouter = Router();

apiRouter.use("/", indexRoute);
apiRouter.use("/home", homeRoute);
apiRouter.use("/users", userRoute);
apiRouter.use("/locations", locationsRoute);
apiRouter.use("/uploads", uploadRoute);
apiRouter.use("/kardex", kardexRoute);
apiRouter.use("/assignments", assignmentsRoute);
apiRouter.use("/incidents", incidentRoute);
apiRouter.use("/rounds", roundRoute);
apiRouter.use("/schedules", scheduleRoute);
apiRouter.use("/maintenance", maintenanceRoute);
apiRouter.use("/reports", reportRoute);
apiRouter.use("/catalog", catalogRoute);
apiRouter.use("/clients", clientsRoute);
apiRouter.use("/zones", zonesRoute);
apiRouter.use("/recurring", recurringRoute);
apiRouter.use("/settings", settingsRoute);
apiRouter.use("/sync", syncRoute);

export default apiRouter;
