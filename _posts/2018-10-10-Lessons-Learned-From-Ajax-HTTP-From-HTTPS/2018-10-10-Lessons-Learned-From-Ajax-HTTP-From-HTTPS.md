---
layout: post
title: "Lessons Learned by ajax request http from https"
date: 2018-10-10
categories: [Website]
abstract: "Recently, I am thinking to build a subscribe page, and as this website based on jelyll and set in github, If I want to interact with some dynamic scripts I need to have another server and communicate with this one using ajax. The idea is simple, until I started to submit my codes to github!! Gituhub pages are based on https!!! I never really dig into why there is more and more websites are based on https, and yeah, I see now. This blog is about all lessons I learned from my experiment and my ultimate findings and solutions."
abstract_img: "/static/img/2018-10-10-Lessons-Learned-From-Ajax-HTTP-From-HTTPS/IMG_2254.JPG"
---
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script>
	function get_subscribe_status () {
		$.ajax({
			url: "http://ec2-18-191-213-11.us-east-2.compute.amazonaws.com/subscribe_status",
			type: 'get',
			dataType: 'text'
		}).done(function(data) {
		    $("#subscribe_status_result").removeClass("Loading");
			$("#subscribe_status_result").text("[Suceessfully] data is " + data);
		}).error(function(request, status, error){
		    $("#subscribe_status_result").removeClass("Loading");
		    $("#subscribe_status_result").text("[Error] Mixed Content: The page at 'https://xuechendi.github.io/2018/10/10/Lessons-Learned-From-Ajax-HTTP-From-HTTPS' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://ec2-18-191-213-11.us-east-2.compute.amazonaws.com/subscribe_status'. This request has been blocked; the content must be served over HTTPS.");
		});
	}
	
	$(document).ready(function(){
	    $("#subscribe_status").click(function(){
		    $("#subscribe_status_result").addClass("Loading");
		    get_subscribe_status ();
		});
	});
</script>
<style>
.Loading {
    background-image: url("/static/img/loadingAnimation.gif");
	background-repeat: no-repeat;
	background-size: cover;
}
</style>
<br>
I am building my jekyll blog portal recently on github, and since github is static, while I still want to add some cool features who can not be simply implemented by javascript inside browser, I came up this thought, <strong> can I ajax to my amazon EC2 virtual machine to handle some dynamic requests? </strong>

And I have this image in my mind.
<img alt="From-Ajax-HTTP-From-HTTPS" src="/static/img/2018-10-10-Lessons-Learned-From-Ajax-HTTP-From-HTTPS/IMG_2254.JPG" style="max-width: 300px">

#### Then let's consider this idea for a bit: ####

Exists Conditions:
* github is now using https protocol for hosting page site, which means my browser is a https client.
* It's easy to host a http server on EC2.

***
#### [IDEA 1] ####
Then I came up with a very naive idea, <strong> Is it possible to ajax to a http website from https client? </strong>

The answer is NO! Because to request http site data from https downgraded this https website's security level. [Reference](https://developers.google.com/web/fundamentals/security/prevent-mixed-content/what-is-mixed-content)

A live example, press <button id="subscribe_status">run example</button> to test

``` javascript
function get_subscribe_status () {
	$.ajax({
		url: "http://ec2-18-191-213-11.us-east-2.compute.amazonaws.com/subscribe_status",
		type: 'get',
		dataType: 'text'
	}).done(function(data) {
		$("div.subscribe-block-status").text(data);
	});
}
```

Result: 
<div id="subscribe_status_result" style="border: 1px solid #999; min-width: 50%; min-height: 20px; background-color: #eee;"> </div>

***
#### [IDEA 2] ####
Ok, but since this is my own website, <strong> how about I simply downgraded my github site to http? </strong>

The Answer is also NO!! [GITHUB OFFICIAL HELP](https://help.github.com/articles/securing-your-github-pages-site-with-https/)

> HTTPS enforcement is required for GitHub Pages sites using a github.io domain that were created after June 15, 2016. If you created your GitHub Pages site before June 15, 2016, you can manually enable HTTPS enforcement.

I closed my github pages and re-open in 2018... Hum... So I can't downgrade it... [Sad Face]

***
#### [IDEA 3] ####
Hum, <strong> but I can upgrade my EC2 site to provide HTTPS!! How about that? </strong>

The Answer is YES to someone but NO to me....

Firstly, it is possible to lauch a HTTPS server by you own. All you need to do is to use openssl to create a private key, then public key and use the key to assign a certificate.

``` bash
openssl genrsa -des3 -out server.key 1024
openssl req -new -key server.key -out server.csr
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt 
```

And then provide this key to your web server process.

But, a self-assigned key is just like a self-assigned job title, no one believes you since the title is not authorized.
<img alt="browser server talk" src="/static/img/2018-10-10-Lessons-Learned-From-Ajax-HTTP-From-HTTPS/IMG_2256.PNG" style="max-width: 350px">

So, if I hosting a https website with a self-assigned certificate, Browser will try to warn visitors and even worse, if I browser such a site with my iphone, safari simply declined with no asking...

And in order to have an <strong>AUTHORIZED</strong> SSL Certificate, I need a domain name which is under my own control.

Since I registered a free-trial amazonaws account, and I can't have a domain name for my EC2 virtual machine.
This is a NO-WAY to me.


***
#### [IDEA 4] ####
I gave up and went to sleep, and while laying in my bed, there is one question arised.
<strong>Do I have to use http or https? Can I use a socket request? Or other protocol?</strong>

And, yes, there is another protocol called "[websockets](https://en.wikipedia.org/wiki/WebSocket)".

But, quote by [this link](https://stackoverflow.com/questions/9745249/html5-websocket-with-ssl)

> When the page is accessed through HTTP, you can use WS or WSS (WebSocket secure: WS over TLS) . However, when your page is loaded through HTTPS, you can only use WSS - browsers don't allow to "downgrade" security. You can't use WebSockets over HTTPS, but you can use WebSockets over TLS (HTTPS is HTTP over TLS).
 
Alright, then how about using socket? I can't find my reference, but seems this is a experimental feature in many browser, and I didn't really try it...
 
***
 
After all, I gave up, but I think all these info I got deserved my time, so want to share my experience here.
 
Bye!

 
