module.exports = {
  apps : [{
    name: 'API',
    script: 'app.js',
  }],

  deploy : {
    production : {
      user : 'ubuntu',
      host : '3.218.33.203',
      key  : '~/.ssh/SeikatsuServer.pem',
      ref  : 'origin/master',
      repo : 'git@github.com:Doviebear/SeikatsuServer.git',
      path : '/home/ubuntu/SeikatsuServer',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
