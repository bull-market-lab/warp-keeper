FROM node:16.19.1

# ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN yarn install

RUN yarn tsc --project tsconfig.json

CMD node ./build/bot.js
