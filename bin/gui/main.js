var {ipcRenderer}=require('electron');
window.$ = window.jQuery = require("jquery");

var check = false; //used when sending emails
var runtimer = 0
var runningScreen=(rt)=>{
    setTimeout(()=>{
        let rscreen = document.getElementById('runningScreen');
        let txt = rscreen.innerText;
        if(txt.length>11){
        rscreen.innerText = 'RUNNING.'
        }else{rscreen.innerText = txt+'.'}
    },100+rt);
}

// ACTIONS ///////////////////////////////////////////////////////////////
  document.getElementById('runDailyWOEmails').addEventListener('click',(ele)=>{
    ipcRenderer.send('RUN-DailyWOEmails',{confirm:false});
    ipcRenderer.send('CHECK-DailyWOEmails','CHECK');
    $(document.getElementById('runningScreen')).show();
    check = true;
  });
  document.getElementById('confirmDailyWOEmails').addEventListener('click',(ele)=>{
    ipcRenderer.send('RUN-DailyWOEmails',{confirm:true});
    ipcRenderer.send('CHECK-DailyWOEmails','CHECK');
    check = true;
    $(document.getElementById('runningScreen')).show();
    $(document.getElementById('confirmDailyWOEmails')).hide();
  });
  //////////////////////////////////////////////////////////////////////////

  // RESPONSES /////////////////////////////////////////////////////////////
  ipcRenderer.on('RUN-DailyWOEmails',(eve,data)=>{
    console.log(data);
    if(data.ran){
      console.log(data.msg);
    }else{
      if(!data.confirm){
        check = false;
        $(document.getElementById('runningScreen')).hide();
        $(document.getElementById('confirmDailyWOEmails')).show();
      }
    }
  });
  ipcRenderer.on('CHECK-DailyWOEmails',(eve,data)=>{
    if(check){
      if(data.finished){
        check = false;
        $(document.getElementById('runningScreen')).hide();
      }else{
        //display what is still running
        runningScreen(runtimer+=100);

        ipcRenderer.send('CHECK-DailyWOEmails','CHECK');

      }
    }
  });
  
  ipcRenderer.on('Error-Alert', (eve,data)=>{
    window.alert(data.msg);
  });