module.exports = {
  roots: ["./src"],
  testEnvironment: "jsdom",
  testMatch: ["**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
    ".+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub",
  },
};
