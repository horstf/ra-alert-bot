FROM alpine

# Installs latest Chromium (92) package.
RUN apk add --no-cache \
      chromium \
      nodejs \
      yarn
# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Puppeteer v10.0.0 works with Chromium 92.
RUN yarn add puppeteer@11.0.0

WORKDIR /code

COPY . .

RUN ["yarn"]
RUN ["yarn", "build"]
CMD ["yarn", "js:start"]