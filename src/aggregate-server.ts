import { Datastore } from "@google-cloud/datastore";
import { createServer, RequestListener } from "http";
import { logger } from "@mish-tv/stackdriver-logger";

import { createAggregator } from "./aggregator";

const datastore = new Datastore();
const distributedCounterKind = process.env["DISTRIBUTED_COUNTER_KIND"];
const aggregate = createAggregator(distributedCounterKind, { datastore });

const listener: RequestListener = (req, res) => {
  const buffer: Uint8Array[] = [];
  req
    .on("error", (e) => {
      logger.error(e);
      res.statusCode = 400;
      res.end();
    })
    .on("data", (chunk) => {
      buffer.push(chunk);
    })
    .on("end", async () => {
      try {
        const { key } = JSON.parse(Buffer.concat(buffer).toString());
        await aggregate(datastore.key(key));
        res.statusCode = 200;
        res.end("ok");
      } catch (e) {
        logger.error(e);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
};

const server = createServer(listener);
const port = process.env["PORT"] ?? "8080";
server.listen(Number(port), () => {
  console.debug(`Listening and serving HTTP on :${port}`);
});
