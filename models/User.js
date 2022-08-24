const { Schema, model } = require('mongoose')

const User = model('User', Schema({
    username: String,
    password: String,
    email: String
}))

module.exports = User