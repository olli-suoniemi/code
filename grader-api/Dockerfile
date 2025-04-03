FROM node:18-alpine

EXPOSE 7000

WORKDIR /app

RUN apk add --update docker openrc
RUN rc-update add docker boot
RUN addgroup node docker

COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 7000

# Start the application
CMD ["node", "worker.js"]
