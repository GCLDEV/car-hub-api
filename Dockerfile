# Use Node.js 18 alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /opt/app

# Install system dependencies
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev nasm bash vips-dev git

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn config set network-timeout 600000 -g && yarn install --frozen-lockfile

# Set environment variables
ENV NODE_ENV=production

# Copy project files
COPY . .

# Build Strapi admin panel
RUN yarn build

# Create uploads directory with proper permissions
RUN mkdir -p /opt/app/public/uploads && chown -R node:node /opt/app

# Switch to non-root user
USER node

# Expose port
EXPOSE 1337

# Start the application
CMD ["yarn", "start"]