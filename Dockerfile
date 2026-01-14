# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /opt/app

# Install dependencies needed for building
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git

# Copy package files
COPY package.json yarn.lock* ./

# Install only production dependencies (much faster)
RUN yarn install --production --frozen-lockfile --ignore-engines

# Copy application code
COPY . .

# Create uploads directory and set permissions in one layer
RUN mkdir -p public/uploads && chown -R node:node /opt/app

# Switch to node user
USER node

# Expose port
EXPOSE 1337

# Start in development mode
CMD ["yarn", "develop"]