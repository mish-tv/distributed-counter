import { Datastore } from "@google-cloud/datastore";
import { createServer, RequestListener } from "http";
import { logger } from "@mish-tv/stackdriver-logger";

import { createAggregator, isExcludeFromIndexes } from "./aggregator";

const datastore = new Datastore();
const distributedCounterKind = process.env["DISTRIBUTED_COUNTER_KIND"];
const excludeFromIndexes = (() => {
  const excludeFromIndexesJSON =
    process.env["DISTRIBUTED_COUNTER_EXCLUDE_FROM_INDEXES"];
  if (excludeFromIndexesJSON == undefined) return {};
  const excludeFromIndexes = JSON.parse(excludeFromIndexesJSON);
  if (!isExcludeFromIndexes(excludeFromIndexes)) {
    throw new Error(
      `illegal DISTRIBUTED_COUNTER_EXCLUDE_FROM_INDEXES: ${excludeFromIndexesJSON}`
    );
  }

  return excludeFromIndexes;
})();

const aggregate = createAggregator(distributedCounterKind, excludeFromIndexes, {
  datastore,
});

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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
