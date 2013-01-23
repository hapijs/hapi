module.exports = function (blanket) {

    blanket.options("filter", /^((?!\/node_modules\/).)((?!\/test\/).)*$/);
};