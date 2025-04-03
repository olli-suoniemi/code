import { connect } from "../deps.js";

const redis = await connect({
  hostname: "redis",
  port: 6379,
});

const cacheMethodCalls = (object, methodsToFlushCacheWith = []) => {
  const handler = {
    get: (module, methodName) => {
      const method = module[methodName];
      return async (...methodArgs) => {
        if (methodsToFlushCacheWith.includes(methodName)) {

          try {
            // Check cache state before flushing
            const cacheKeys = await redis.keys('*');

            // Delete all keys except 'submissions_stream'
            for (const key of cacheKeys) {
              if (key !== 'submissions_stream') {
                await redis.del(key);
              }
            }

          } catch (error) {
            console.error("Error during cache flush:", error.message || error);
          }

          // Proceed with method execution
          return await method.apply(this, methodArgs);
        }

        // Cache logic for methods not in methodsToFlushCacheWith
        const cacheKey = `${methodName}-${JSON.stringify(methodArgs)}`;
        const cacheResult = await redis.get(cacheKey);

        if (!cacheResult) {
          const result = await method.apply(this, methodArgs);
          await redis.set(cacheKey, JSON.stringify(result));
          return result;
        }

        return JSON.parse(cacheResult);
      };
    },
  };

  return new Proxy(object, handler);
};

export { cacheMethodCalls };
