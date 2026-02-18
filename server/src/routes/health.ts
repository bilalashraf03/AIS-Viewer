import { Request, Response, Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
