#!/bin/bash
# A tool for installing all the pre-requisite components
# git
sudo apt-get -y install git

# fonts for phantomjs
sudo apt-get -y install libfontconfig

# nginx
sudo apt-get -y install nginx

# pip
sudo apt-get -y install python-pip

# flask
sudo pip install Flask
sudo pip install Flask-KVSession

# boto for AWS
sudo pip install boto

# united code
git clone --recursive git://github.com/polastre/united.git

# phantomjs
wget https://phantomjs.googlecode.com/files/phantomjs-1.9.0-linux-x86_64.tar.bz2
tar xvjf phantomjs-1.9.0-linux-x86_64.tar.bz2
sudo ln -s `pwd`/phantomjs-1.9.0-linux-x86_64/bin/phantomjs /usr/local/bin/phantomjs

# casperjs
git clone git://github.com/n1k0/casperjs.git
cd casperjs
git checkout tags/1.0.2
sudo ln -sf `pwd`/bin/casperjs /usr/local/bin/casperjs
