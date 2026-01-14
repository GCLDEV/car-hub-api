# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /opt/app

# Install dependencies needed for building
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git

# Copy package files
COPY package.json yarn.lock* ./

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p public/uploads

# Set proper permissions
RUN chown -R node:node /opt/app
USER node

# Expose port
EXPOSE 1337

# Start without admin panel for now
CMD ["yarn", "strapi", "start"]