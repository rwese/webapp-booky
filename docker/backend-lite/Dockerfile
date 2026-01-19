FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY prisma ./prisma/
COPY dist ./dist/

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
