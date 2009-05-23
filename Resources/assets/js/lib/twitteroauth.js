/*
Script: twitteroauth.js
	Class for initializing Twitter OAuth.

License:
	MIT-style license.

Copyright:
	Copyright (c) 2009 [Lim Chee Aun](http://cheeaun.com).
*/

var TwitterOAuth = new Class({

	Implements: [Options],

	options: {
		consumerKey: '',
		consumerSecret: '',
		token: '',
		tokenSecret: '',
		rootURL: 'http://twitter.com/',
		requestTokenPath: 'oauth/request_token',
		authorizePath: 'oauth/authorize',
		accessTokenPath: 'oauth/access_token'
	},
	
	initialize: function(options){
		this.setOptions(options);
	},
	
	requestToken: function(options){
		options = $merge({
			onSuccess: function(){},
			onFailure: function(){}
		}, options || {});
		
		var header = this.prepareHeader('GET', this.options.rootURL + this.options.requestTokenPath, {
			consumerKey: this.options.consumerKey,
			consumerSecret: this.options.consumerSecret
		});
		
		return new Request({
			url: header.path,
			method: header.method,
			data: header.body,
			headers: {
				Authorization: header.header
			},
			onSuccess: function(data){
				var d = OAuth.decodeForm(data);
				this.token = OAuth.getParameter(d, 'oauth_token');
				this.tokenSecret = OAuth.getParameter(d, 'oauth_token_secret');
				var url = this.options.rootURL + this.options.authorizePath + '?oauth_token=' + this.token;
				options.onSuccess.run(url);
			}.bind(this),
			onFailure: options.onFailure
		}).send();
	},
	
	accessToken: function(options){
		options = $merge({
			onSuccess: function(){},
			onFailure: function(){}
		}, options || {});

		var header = this.prepareHeader('GET', this.options.rootURL + this.options.accessTokenPath, {
			consumerKey: this.options.consumerKey,
			consumerSecret: this.options.consumerSecret,
			token: this.token,
			tokenSecret: this.tokenSecret
		});
		
		return new Request({
			url: header.path,
			method: header.method,
			data: header.body,
			headers: {
				Authorization: header.header
			},
			onSuccess: function(data){
				var d = OAuth.decodeForm(data);
				this.options.token = OAuth.getParameter(d, 'oauth_token');
				this.options.tokenSecret = OAuth.getParameter(d, 'oauth_token_secret');
				options.onSuccess.run([this.options.token, this.options.tokenSecret]);
			}.bind(this),
			onFailure: options.onFailure
		}).send();
	},
	
	prepareHeader: function(method, path, accessor, data){
		var consumer = {
			method: method,
			action: path,
			parameters: data || {}
		};
		var body = OAuth.formEncode(consumer.parameters);
		OAuth.completeRequest(consumer, accessor);
		var header = OAuth.getAuthorizationHeader(path, consumer.parameters);
		return {
			method: method,
			path: path,
			header: header,
			body: body
		};
	},
	
	standardHeader: function(method, path, data){
		return this.prepareHeader(method, path, {
			consumerKey: this.options.consumerKey,
			consumerSecret: this.options.consumerSecret,
			token: this.options.token,
			tokenSecret: this.options.tokenSecret
		}, data);
	},
	
	initMethod: function(path, options){
		if (!path) return;
		options = $merge({
			onSuccess: function(){},
			onFailure: function(){},
			method: 'GET'
		}, options || {});
		path = this.options.rootURL + path + '.json';
		if (options.data) path += '?' + $H(options.data).toQueryString();
		
		var header = this.standardHeader(options.method, path);
		
		return new Request.JSON({
			url: header.path,
			method: header.method,
			data: header.body,
			headers: {
				Authorization: header.header
			},
			onSuccess: options.onSuccess,
			onFailure: options.onFailure
		}).send();
	}

});