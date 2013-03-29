#!/usr/bin/python
import os
import traceback
import urllib
import urllib2
import time
import datetime
import json
# Multiprocessing pool for processing requests to casperjs
import multiprocessing
from multiprocessing import Pool
import subprocess
# AWS for sending email
import boto.ses
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from jinja2 import Template, Environment, FileSystemLoader
# Flask components
from flask import Flask, jsonify, render_template, request, session
from werkzeug.contrib.fixers import ProxyFix
# Use KVSessions to store the session data server-side in memory
from simplekv.memory import DictStore
from flaskext.kvsession import KVSessionExtension

# The directory to store logs.  Set to '' to disable
LOG_DIR = 'results'
# Number of multiprocessing pool workers to spawn
POOL_WORKERS = 10
# URL to verify captchas
CAPTCHA_URL = 'http://www.google.com/recaptcha/api/verify'
# Put your own CAPTCHA key in here.
CAPTCHA_PUBLIC = os.environ.get('CAPTCHA_PUBLIC',
                                ''
                                )
CAPTCHA_PRIVATE = os.environ.get('CAPTCHA_PRIVATE',
                                 ''
                                 )
# Put your own Flickr key in here.
FLICKR_PUBLIC = os.environ.get('FLICKR_PUBLIC',
                               ''
                                )
# AWS SES is used to send emails. Put it in here.
AWS_KEY = os.environ.get('AWS_KEY',
                         ''
                         )
AWS_SECRET = os.environ.get('AWS_SECRET',
                            ''
                            )
# Google Analytics public id
GA_PUBLIC = os.environ.get('GA_PUBLIC',
                           ''
                           )

store = DictStore()
app = Flask(__name__)
KVSessionExtension(store, app)

def log_job(log_dir, job):
    """ Log information about the job to keep statistics.
        Stored in a csv file in LOG_DIR called requests.csv 
        """
    if log_dir == '':
        return
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    if not os.path.exists("%s/requests.csv" % log_dir):
        f = open("%s/requests.csv" % log_dir, 'w')
    else:
        f = open("%s/requests.csv" % log_dir, 'a')
    f.write('%s,%s,"%s",%s,%s,%s,%s\n' % (job['time'],
                                          job['ip'],
                                          job['email'],
                                          job['from'],
                                          job['to'],
                                          job['start'],
                                          job['end']))
    f.close()

def log_result(log_dir, t, r):
    """ Log each raw result for later use, if needed. """
    if log_dir == '':
        return
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    f = open("%s/%s.json" % (log_dir, t), 'w')
    f.write(r)
    f.close()

def log_error(log_dir, e):
    """ Log an error to the error log: LOG_DIR/error.log """
    if log_dir == '':
        return
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    if not os.path.exists("%s/error.log" % log_dir):
        f = open("%s/error.log" % log_dir, 'w')
    else:
        f = open("%s/error.log" % log_dir, 'a')
    f.write('[%s] %s' % (str(time.time()), e))
    f.close()

def run_search(params):
    """ Run by multiprocessing to execute the search queries.
        Logs errors to LOG_DIR/error.log
        """
    try:
        result = process_search(params)
    except Exception as e:
        log_error(params['log_dir'],
                  "%s - %s > %s\n%s\n%s" % (params['time'],
                                            params['from'],
                                            params['to'],
                                            str(e), 
                                            traceback.format_exc()))
        return None
    return result

def process_search(params):
    """ Executes the actual query """
    script_path = os.path.abspath(os.path.dirname(__file__) + '/../')
    command = ['/usr/local/bin/casperjs',
               '--ignore-ssl-errors=yes',
               '%s/united.js' % script_path,
               '--json',
               params['from'],
               params['to'],
               params['start'],
               params['end']
               ]
    shell_params = {
        'command': command,
        'cwd': script_path,
        }
    (o,e) = shell_exec(**shell_params)
    log_result(params['log_dir'], params['time'], o)
    results = json.loads(o)
    for r in results:
        for entry in r:
            # Ignore this entry if it is an error message
            if 'error' in entry:
                del results[r]
                break
            entry['prettyDate'] = datetime.datetime.strptime(entry['date'], "%m/%d/%Y").strftime("%A, %B %d, %Y")
    conn = boto.ses.connect_to_region(
        'us-east-1',
        aws_access_key_id = params['aws_key'],
        aws_secret_access_key = params['aws_secret']
        )
    # app flask context doesn't transfer over to processes, so need to use
    # jinja2 directly to render template
    env = Environment(loader=FileSystemLoader('templates/'))
    template = env.get_template('email.html')
    # render the email result
    body_html = template.render(results = results,
                                params = params
                                )
    template = env.get_template('email.txt')
    body_txt = template.render(results = results,
                               params = params
                               )
    # Create message container
    msg = MIMEMultipart('related')
    msg.set_charset('UTF-8')
    msg['Subject'] = u'%s to %s (%s to %s) - Results from UnitedUpgrades.com' % (params['from'], params['to'], params['start'], params['end'])
    msg['From'] = u'United Upgrades <results@unitedupgrades.com>'
    msg['To'] = params['email']
    msg['Accept-Language'] = u'en-US'
    msg['Content-Language'] = u'en-US'
    # Subcontainer contains HTML & text content
    msg_content = MIMEMultipart('alternative')
    msg_content.attach(MIMEText(body_txt, 'plain'))
    msg_content.attach(MIMEText(body_html, 'html'))
    msg.attach(msg_content)
    # Image container contains logo, to lower spam score for ext images
    msg_image = MIMEImage(open('static/img/unitedupgrades.gif').read(), 'gif')
    msg_image.add_header('Content-Id', '<unitedupgrades>')
    msg.attach(msg_image)
    r = conn.send_raw_email(source='results@unitedupgrades.com',
                            raw_message=msg.as_string(),
                            destinations=[params['email']]
                            )
    return results

def shell_exec(**params):
    """ Run a shell command and return the output and stderr.
    Provide parameters 'command' as a list with the first item as
    the command and 'cwd' as the current working directory. """
    p = subprocess.Popen(params.get('command'), cwd=params.get('cwd'), stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=params.get('shell', False), close_fds=True)
    out, err = p.communicate()
    if out:
        out = out.decode(encoding='UTF-8')
    return (out, err)

@app.route("/")
def index():
    # Force a session to be created
    if session.get('count') == None:
        session['count'] = 0
    # Return the index page
    return render_template('index.html',
                           flickr = { 'public': FLICKR_PUBLIC },
                           ga = {'public': GA_PUBLIC },
                           captcha = {
            'public': CAPTCHA_PUBLIC,
            'require': session.get('captcha',False) == False,
            },
                           )

@app.route("/submit", methods=['GET', 'POST'])
def submit():
    # Check if client captcha is required
    if session.get('captcha', False) == False:
        captcha = check_recaptcha(request.form['recaptcha_challenge_field'],
                                  request.form['recaptcha_response_field'],
                                  request.remote_addr)
        if captcha == True:
            session['captcha'] = True
        else:
            return jsonify({'result': False, 'message':'Invalid Captcha. Please try entering the Captcha again.'})
    # Enqueue the request in the queue
    job = {
        'time': long(time.time()*1000),
        'ip': request.remote_addr,
        'from': request.form['from'],
        'to': request.form['to'],
        'start': request.form['start'],
        'end': request.form['end'],
        'email': request.form['email'],
        # Pass these variables in since process runs in a different context
        'aws_key': AWS_KEY,
        'aws_secret': AWS_SECRET,
        'log_dir': LOG_DIR,
        }
    log_job(LOG_DIR, job)
    try: 
        r = pool.apply_async(run_search, [job])
        #run_search(job)
    except Exception as e:
        return jsonify({'result': False, 'message':'Something bad happened. Please try again.'})
    return jsonify({'result': True, 'message': "We've successfully received your search! Please check your email in a few minutes for the results.<br/><strong>Tip!</strong> Add <strong>results@unitedupgrades.com</strong> to your spam filters to make sure you get your results."})

def check_recaptcha(challenge, response, remoteip):
    """ Check that recaptcha was correctly input.
        Returns True or False.
        """
    params = { 'privatekey': CAPTCHA_PRIVATE,
               'remoteip': remoteip,
               'challenge': challenge,
               'response': response }
    f = urllib2.urlopen(CAPTCHA_URL, urllib.urlencode(params))
    response = f.read().split("\n")
    return response[0] == 'true'

if __name__ == "__main__":
    # The United website is so slow, that each worker barely takes up any
    # CPU.  So start a whole bunch of listeners in the pool.
    pool = Pool(POOL_WORKERS)
    app.debug = False
    app.secret_key = os.urandom(24)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    app.run(host='0.0.0.0')
