const express = require("express");
const { fork } = require("child_process");
const { Router } = express;
const randomRouter = Router();

module.exports = randomRouter;

randomRouter.get('/', (req, res) => {
  const numeros = req.query.cant || 100000000;
  // const forked = fork('../Entregable/randomNumbers.js', ['--c', numeros]);

  // forked.on('message', nums => {
  //     //forked.send(numeros)
  //     return res.json(nums)
  // })
  return res.json(calc(random(numeros)))
})