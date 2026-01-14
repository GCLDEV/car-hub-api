# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /opt/app

# Install dependencies needed for building
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies with memory limits
RUN NODE_OPTIONS="--max-old-space-size=1024" yarn install --frozen-lockfile

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p public/uploads

# Build for production
RUN NODE_OPTIONS="--max-old-space-size=1024" yarn build

# Set proper permissions
RUN chown -R node:node /opt/app
USER node

# Expose port
EXPOSE 1337

# Start in production mode
CMD ["yarn", "start"]