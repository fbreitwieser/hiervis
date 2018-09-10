var tape = require("tape"),
    hiervis = require("../");

tape("hiervis() returns the answer to the ultimate question of life, the universe, and everything.", function(test) {
  test.equal(hiervis.hiervis(), 42);
  test.end();
});
