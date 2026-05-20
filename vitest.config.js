const { defineConfig } = require("vitest/config");
require("dotenv").config({ path: ".env.test" });

module.exports = defineConfig({
  test: { 
environment: "node", 
globals: true,
maxWorkers: 1, // Avoid database conflicts
coverage: {
    		provider: "v8",
    		reporter: ["text", "html"],
    		include: ["src/**/*.js"],
    		exclude: ["src/generated/**", "src/index.js"],
  	}  
  }
	});
 
