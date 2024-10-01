import Service from "node-windows";

var svc = new Service.Service({
  name:'Richard Bot',
  description: 'Richard Bot.',
  script: 'C:\\Users\\Richard\\Downloads\\discord-example-app\\app.js',
});

svc.on('install',function(){
  svc.start();
});
svc.on('error', (er) => console.log("error" + er));
svc.on('invalidinstallation', er => console.log("invalid" + er));
svc.on('alreadyinstalled ', (er) => console.log("alreadyinstalled" + er));
svc.on('alreadyuninstalled ', (er) => console.log("uninstalled" + er));
svc.install();