module.exports = {
  apps : [{
    name: 'API',
    script: 'app.js',
  }],

  deploy : {
    production : {
      user : 'ubuntu',
      host : 'ec2-54-80-227-172.compute-1.amazonaws.com',
      key  : '~/.ssh/SeikatsuServer.pem',
      ref  : 'origin/master',
      repo : 'https://github.com/Doviebear/SeikatsuServer.git',
      path : '/home/ubuntu/SeikatsuServer',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
