import { getStore } from "@netlify/blobs";
import { createApp } from "../../server/app.mjs";

const app = createApp(getStore, process.env);

export default (req, context) => app(req, context);

export const config = { path: "/api/*" };
