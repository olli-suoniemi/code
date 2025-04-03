# Use an official Deno image as the base
FROM denoland/deno:alpine-1.36.1

# Set the working directory
WORKDIR /app

# Copy the Deno source code
COPY . .

# Expose the WebSocket port
EXPOSE 7788

# Run the WebSocket server
CMD [ "run", "--unstable", "--allow-all", "websocket.js" ]
