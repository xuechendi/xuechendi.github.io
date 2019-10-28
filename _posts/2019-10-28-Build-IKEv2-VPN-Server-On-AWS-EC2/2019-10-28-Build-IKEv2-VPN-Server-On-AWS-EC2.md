---
layout: post
title: "How to build IKEv2 VPN server on Amazon AWS EC2"
date: 2019-10-28
categories: []
abstract: "A very nice guide of setting up IKEv2 VPN server on EC2 by using strongswan(ipsec)"
abstract_img: ""
---

I recently setup a VPN server on AWS EC2(free tier), so I can log onto my gmail account in Mainland China.
Here is a very clear and easy to follow step by step guide.

[How to set up an ik2=ev2 vpn server with strongswan on ubuntu 18.04.02](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-ikev2-vpn-server-with-strongswan-on-ubuntu-18-04-2)

Debug:

If you met some issue, please check ipsec log using below cmd:

<code>systemctl status ipsec.service</code>

Remember to also modify you security group on EC2, since it will only allow SSH protocal(tcp 22) as default