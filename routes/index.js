var express = require('express');
var router = express.Router();
const { v4 } = require('uuid');
const fs = require("fs")
const child_process = require("child_process")
const rateLimit = require("express-rate-limit");

const uiLimit = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 50, 
  message:
    "IP của bạn đã bị khoá, vui lòng thử lại sau một khoảng thời gian nhất định"
});

const codeLimit = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 100, 
  onLimitReached: function (req,res) {
    return res.json({ status: "IP của bạn đã bị khoá", runID: "None", return_value: "Vui lòng thử lại sau một khoảng thời gian nhất định" })
  }
});

/* GET home page. */
router.get('/',uiLimit, function (req, res, next) {
  res.render('index');
});

router.get('/blocked', function (req, res, next) {
  res.render('blocked',{blocked:require("../config.json").blocked});
});

async function keyword_check(key,list) {
  var status = false
  await list.forEach(element => {
    if(key.includes(element)) return status = true 
  });
  return status
}


router.post('/api/coderun',codeLimit, async function (req, res, next) {
  let time_limit = 1
  console.log(req.body)
  let codeValue = req.body.code
  let inputValue = req.body.input
  let inputfrom = req.body.inputfrom
  let outputfrom = req.body.outputfrom
  let id = v4()
  if (!fs.existsSync("./run/")) {
		fs.mkdirSync("./run/")
	}

  console.log(inputfrom)

  fs.mkdirSync("./run/" + id + "/")
  //create running file
  fs.writeFile("./run/" + id + "/code.py", codeValue, function (err) {
    if (err) {
      console.log(err);
      return res.status(406).json({ error: "Cannot Create file to run", runningID: id, message: "Problem maybe from the permission missing, check the workspace is have RW permission" })
    }
  });
  if(inputfrom != "console"){
    fs.writeFile("./run/" + id + "/"+inputfrom, inputValue , function (err) {
      if (err) {
        console.log(err);
        return res.status(406).json({ error: "Cannot Create file to run", runningID: id, message: "Problem maybe from the permission missing, check the workspace is have RW permission" })
      }
    });
  }
  
  //code restict
  let compliner_status = "Running"
  // await require("../config.json").blocked.forEach(element => {
  //   // console.log(codeValue.includes(element))
  //   if(codeValue.includes(element)){compliner_status == "Blocked"}
  // });
  console.log(await keyword_check(codeValue,require("../config.json").blocked))
  if(await keyword_check(codeValue,require("../config.json").blocked)) return res.json({ status: "Run Failure", runID: id, err_value: "\nSome Keyword are blocked due to security problem, check:\nhttps://code.namanhishere.com/blocked\n" })
  if(await keyword_check(inputValue,require("../config.json").blocked)) return res.json({ status: "Run Failure", runID: id, err_value: "\nSome Keyword are blocked due to security problem, check:\nhttps://code.namanhishere.com/blocked\n" })
  let console_output = ""
  let compiler = child_process.spawn('python', ["./run/" + id + "/code.py"]);
  

  let current_runtime = 0
  let run_intervial = setInterval(() => {
    current_runtime++
  }, 1);

  
  if (inputValue != '' && inputfrom == "console") {
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
        if(outputfrom != "console"){
          fs.readFile("./run/" + id + "/"+inputfrom, 'utf8' , (err, fdata) => {
            if (err) {
              console.error(err)
              return
            }
            res.json({ status: "Success", runID: id, return_value: console_output, files_value:fdata })
          })
        }else{
          res.json({ status: "Success", runID: id, return_value: console_output })
        }
          
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
