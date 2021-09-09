var express = require('express');
var router = express.Router();
const { v4 } = require('uuid');
const fs = require("fs")
const child_process = require("child_process")

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index');
});



router.post('/api/coderun', function (req, res, next) {
  let time_limit = 1
  console.log(req.body)
  let codeValue = req.body.code
  let inputValue = req.body.input
  let id = v4()
  if (!fs.existsSync("./run/")) {
		fs.mkdirSync("./run/")
	}
  fs.mkdirSync("./run/" + id + "/")
  //create running file
  fs.writeFile("./run/" + id + "/code.py", codeValue, function (err) {
    if (err) {
      console.log(err);
      return res.status(406).json({ error: "Cannot Create file to run", runningID: id, message: "Problem maybe from the permission missing, check the workspace is have RW permission" })
    }
  });
  let console_output = ""
  let compiler = child_process.spawn('python', ["./run/" + id + "/code.py"]);
  let compliner_status = "Running"

  let current_runtime = 0
  let run_intervial = setInterval(() => {
    current_runtime++
  }, 1);

  
  if (inputValue != '') {
    compiler.stdin.write(inputValue)
    compiler.stdin.end()
  }

  compiler.stdout.on('data', function (data) {
    console.log(data.toString())
    console_output += data.toString()
  });

  compiler.stderr.on('data', function (data) {
    compliner_status = "Error"
    let value = String(data)
    // console.log(value);
    res.status(200).json({ status: "Run Failure", runID: id, err_value: value })
  });

  compiler.on('close', function (data) {
    // console.log(console_output)
    switch (compliner_status) {
      case "Running":
        console.log("Time Pass, No Error")
          res.json({ status: "Success", runID: id, return_value: console_output })
        break;

      case "Time":
        console.log("Time Error")
        res.json({ status: "Memory Leak or Time Limited", runID: id, return_value: console_output })
        break;

      case "Error":

      default:
        return
        break;
    }
  })



  setTimeout(() => {
    //stop counting time
    clearInterval(run_intervial)
    //check if the compiler is still running
    if (compliner_status == "Running") {
      compliner_status = "Time"
      compiler.kill()
      console.log("Killed")
    }
  }, time_limit * 1000);
});



module.exports = router;
