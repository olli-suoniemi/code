import { createClient } from "npm:redis@4.6.4";
import { serve } from "https://deno.land/std@0.222.1/http/server.ts";

// Set up Redis client
const redisClient = createClient({
  url: "redis://redis:6379",
  pingInterval: 1000,
});

await redisClient.connect();

const subscriptions = new Map();

// Function to handle Redis channel subscription
const subscribeToChannel = (channel, socket) => {
  console.log(`Subscribing to Redis channel: ${channel}`);
  redisClient.subscribe(channel, (message) => {
    const parsedMessage = JSON.parse(message);
    console.log(`Received message from Redis channel ${channel}. ID: ${parsedMessage.id}. Status: ${parsedMessage.status}.`);
    socket.send(message);
  });
};

// Function to handle WebSocket requests
const handleRequest = async (request) => {
  const { socket, response } = Deno.upgradeWebSocket(request);

  socket.onopen = () => {
    console.log("WebSocket connection opened");

    const url = new URL(request.url);
    const userID = url.searchParams.get("userID");

    if (userID) {
      const channel = `grading_result_${userID}`;

      if (!subscriptions.has(userID)) {
        subscribeToChannel(channel, socket);
        subscriptions.set(userID, channel);
      }

      socket.onclose = () => {
        console.log("WebSocket connection closed");
        redisClient.unsubscribe(subscriptions.get(userID));
        subscriptions.delete(userID);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    } else {
      console.log("Admin WebSocket connection");
      const adminChannel = "admin_updates";

      if (!subscriptions.has(adminChannel)) {
        subscribeToChannel(adminChannel, socket);
        subscriptions.set(adminChannel, adminChannel);
      }

      socket.onclose = () => {
        console.log("Admin WebSocket connection closed");
        redisClient.unsubscribe(subscriptions.get(adminChannel));
        subscriptions.delete(adminChannel);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    }
  };

  socket.onmessage = (event) => {
    console.log("Received message from client:", event.data);
    // Handle incoming WebSocket messages if needed
  };

  return response;
};

// Serve WebSocket on port 7788
serve(handleRequest, { port: 7788, hostname: "0.0.0.0" });
