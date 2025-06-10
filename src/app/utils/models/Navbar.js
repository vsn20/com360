const { default: mongoose } = require("mongoose");

const navbarschema=new mongoose.Schema({
    name:{
        type:String,
    },
    href:{
        type:String,
    },
});

const navbar=mongoose.models.navbar||mongoose.model("navbar",navbarschema);

export default navbar;