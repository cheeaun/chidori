var debug = 1;

if (!console) console = {log: function(){}};
if (!debug) console.log = function(){};

var App = {
	
	consumerKey: 'wGLoNKCoLDxwZbbSKbUQ',
	consumerSecret: 'OWHW029FgInLrkpFtvjzsneM7t4j4KaST5mNx2HVbjU',
	configTable: 'config',
	config: {
		profile: 'default',
		token: '',
		tokenSecret: '',
		theme: ''
	},
	data: {
		credentials: {},
		statuses: {}
	},
	
	init: function(){
	
		// Init the database
		var db = App.db = openDatabase('app', '0.1', 'App Database', 200000);
		if (!App.db) console.log('Database Failed.');
		
		// Get all config
		db.transaction(function(tx){
			tx.executeSql('SELECT * FROM ' + App.configTable + ' WHERE profile = ?', [App.config.profile], function(tx, results){
				console.log('Database already created.');
				var row = results.rows.item(0); // Just get first row
				$extend(App.config, row);
				App.initConnect();
			}, function(tx, error){
				var conf = [], confMark = [], confKey = [], confValue = [];
				$each(App.config, function(val, key){
					conf.push(key + ' TEXT');
					confKey.push(key);
					confValue.push(val);
					confMark.push('?');
				});
				tx.executeSql('CREATE TABLE ' + App.configTable + ' (' + conf.join(',') + ')', [], function(tx){
					console.log('Database created.');
					tx.executeSql('INSERT INTO ' + App.configTable + ' (' + confKey.join(',') + ') VALUES (' + confMark.join(',') + ')', confValue, function(tx){
						console.log('Database keys/values created.');
						App.initConnect();
					}, function(tx, error){
						console.log('Database keys/values CANNOT be created.');
					});
				}, function(tx, error){
					console.log('Database CANNOT be created.');
				});
			});
		});
		
	},
	
	initConnect: function(){
		App.twoa = new TwitterOAuth({
			consumerKey: App.consumerKey,
			consumerSecret: App.consumerSecret
		});
		
		App.initEvents();
		
		// check has token and tokenSecret?
		if (App.config.token && App.config.tokenSecret){
			App.twoa.setOptions({
				token: App.config.token,
				tokenSecret: App.config.tokenSecret
			}).initMethod('account/verify_credentials', {
				onSuccess: function(data){
					App.data.credentials.id = data.id;
					App.data.credentials.screen_name = data.screen_name;
					App.connectCanvas.fade('out');
					App.load();
				},
				// If can't verify, means token expired or revoked.
				onFailure: App.generateAuthLink
			});
		} else {
			App.generateAuthLink();
		}
	},
	
	generateAuthLink: function(){
		App.twoa.requestToken({
			onSuccess: function(url){
				App.authorizeLink = $('authorize').set('href', url);
				App.connectSteps = $('connect-steps').show();
			},
			// If fail, keep trying
			onFailure: App.generateAuthLink
		});
	},
	
	verifyCredentials: function(){
		App.twoa.initMethod('account/verify_credentials', {
			onSuccess: function(data){
				App.data.credentials.id = data.id;
				App.data.credentials.screen_name = data.screen_name;
				App.connectCanvas.fade('out');
				App.load();
			},
			// If can't verify, means token expired or revoked.
			onFailure: App.generateAuthLink
		});
	},
	
	initEvents: function(){
	
		// Connect
		var connectBusy = false;
		App.connectLink = $('connect');
		App.connectCanvas = $('connect-canvas');
		App.connectLink.addEvent('click', function(e){
			e.stop();
			if (connectBusy) return;
			connectBusy = true;
			
			App.twoa.accessToken({
				onSuccess: function(token, tokenSecret){
					$extend(App.config, {
						token: token,
						tokenSecret: tokenSecret
					});
					App.db.transaction(function(tx){
						tx.executeSql('UPDATE ' + App.configTable + ' SET token=?, tokenSecret=? WHERE profile = ?', [token, tokenSecret, App.config.profile], function(){
							App.connectSteps.fade('out');
							App.verifyCredentials();
							connectBusy = false;
						});
					});
				},
				// If fail, means user denied access or didn't do anything at all.
				onFailure: function(){
					App.generateAuthLink();
					connectBusy = false;
				}
			});
		});
		
		// External URLs
		document.addEvents({
		
			focus: function(){
				$('home').focus();
			},
			
			click: function(e){
				var el = e.target;
				App.handleInReplies(e, el);
			}
			
		});
		
		// Setup canvas sections for nav links
		App.canvasSections = $('canvas-sections');
		App.canvasSections.getElements('section').each(function(el, i){
			if (i==0) return;
			el.setStyle('left', i*100 + '%');
		});
		
		App.handleNavLinks();
		App.handleSUME();
		App.handleKeyboardNav();
		
	},
	
	handleNavLinks: function(){
		App.currentSection = 'home';
		
		$$('nav li a').addEvent('click', function(e){
			e.stop();
			var elParent = this.getParent('li');
			if (elParent.hasClass('selected')) return;
			elParent.getParent().getChildren('.selected').removeClass('selected');
			elParent.addClass('selected');
			App.currentSection = this.get('href').split('#')[1];
			var smoothScroll = App.canvasSections.retrieve('smoothScroll', new Fx.Scroll(App.canvasSections, {
				transition: Fx.Transitions.Cubic.easeInOut,
				link: 'cancel',
				wheelStops: false
			}));
			smoothScroll.toElement(App.currentSection);
		});
	},
	
	handleInReplies: function(e, el){
		if (el.tagName.toLowerCase() != 'a') return;
		if (!el.hasClass('in-reply')) return;
		
		e.stop();
		
		if (el.hasClass('busy')) return;
		
		el.toggleClass('selected');
		
		var elParent = el.getParents('.status').getLast();
		var statusId = el.get('href').replace('#', ''); // get the id of status
		var elem = elParent.getElement('.id-' + statusId); // get the element with the id
				
		if (elem){
			elem.toggleReveal();
			// Toggle also the 'next' statuses
			var elemNext = elem.getAllNext('.status');
			if (!elemNext.length) return;
			(el.hasClass('selected')) ? elemNext.reveal() : elemNext.dissolve();
			return;
		}
		
		el.addClass('busy'); // busy flag to simulate link: ignore for multi-clicks of the in-reply link
		
		var status = App.data.statuses[statusId];
		
		var injectTweet = function(st){
			var smallOl = elParent.getElement('ol.small');
			if (!smallOl) smallOl = new Element('ol', {'class': 'small'}).inject(elParent);
			var tweet = App.formatStatus(st, 'small');
			tweet.hide().inject(smallOl).set('reveal', {
				onStart: function(){
					el.addClass('busy');
				},
				onComplete: function(){
					el.removeClass('busy');
				}
			}).reveal();
			App.setTimeDiffs();
		};
		
		if (status){
			injectTweet(status);
		} else {
			var fail = function(){
				el.removeClass('selected').removeClass('busy');
			};
			
			App.twoa.initMethod('statuses/show/' + statusId, {
				onSuccess: function(data){
					(data.error) ? fail() : injectTweet(data);
				},
				onFailure: fail
			});
		}
	},
	
	handleSUME: function(){
		// Smart Unread Marking Engine (SUME)
		var inCanvas = false;
		var moveBusy = false;
		var delayScroll = false;
		App.freezeSUME = false;
		App.mainCanvas = $('main-canvas').addEvents({
			mouseenter: function(){
				inCanvas = true;
			},
			mouseleave: function(){
				inCanvas = false;
			},
			mouseover: function(e){
				if (App.freezeSUME) return;
				var el = e.target;
				if (el.get('tag') !== 'li' || !el.hasClass('unread')) el = el.getParents('li.unread');
				el.removeClass('unread');
			}
		});
		App.canvasSections.getElements('section').addEvent('scroll', function(){
			if (App.freezeSUME) return;
			if (delayScroll) return;
			delayScroll = true;
			(function(){ delayScroll = false; }).delay(50);
			if (!inCanvas) return;
			if (moveBusy) return;
			var unreads = this.getElements('li.unread:inView');
			if (!unreads.length) return;
			moveBusy = true;
			(function(){
				unreads.removeClass('unread');
				moveBusy = false;
			}).delay(800);
		});
	},
	
	handleKeyboardNav: function(){
		var sections = App.canvasSections.getElements('section');
		sections.each(function(section){
			section.addEventListener('focus', function(e){
				var el = e.target;
				if (el.hasClass('status')) el.addClass('focus').removeClass('unread'); // Also part of the SUME system.
			}, true);
			section.addEventListener('blur', function(e){
				var el = e.target;
				if (el.hasClass('status')) el.removeClass('focus');
			}, true);
		});
		sections.addEvent('keydown', function(e){
			var keys = ['up', 'down', 'space'];
			if (!keys.contains(e.key)) return;
			var inViews = this.getElements('.status:inView');
			var focusedStatus = inViews.filter('.focus');
			switch (e.key){
				case 'up':
					if (focusedStatus.length && focusedStatus[0]){
						var prev = focusedStatus.getPrevious('.status');
						if (!prev.length) return;
						prev[0].focus();
						e.stop();
					} else {
						inViews.getLast().focus();
						e.stop();
					}
					break;
				case 'down':
					if (focusedStatus.length && focusedStatus[0]){
						var next = focusedStatus.getNext('.status');
						if (!next.length) return;
						next[0].focus();
						e.stop();
					} else {
						inViews[0].focus();
						e.stop();
					}
					break;
			}
		});
	},
	
	initTheme: function(){
		var themeDir = 'assets/css/themes/';
		var theme = App.config.theme;
		if (!theme){
		  console.log(Titanium.Platform.name);
			switch (Titanium.Platform.name){
				case 'Windows NT': theme = 'windows-vista'; break;
				case 'Darwin': theme = 'mac-aqua'; break;
			}
		}
		if (theme) new Asset.css(themeDir + theme + '.css', { id: theme });
	},
	
	statusIfy: function(status){
		return status.replace(/((https?|s?ftp|ssh)\:\/\/[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!])/g, function(m){
			return '<a href="' + m + '" class="url external-url" target="ti:systembrowser" title="' + m + '">' + m + '</a>';
		}).replace(/(^|\s+)\#([\w|-|\.]+)/g, '$1<a href="http://search.twitter.com/search?q=%23$2" class="url hashtag" target="ti:systembrowser">#$2</a>').replace(/\B@([_a-z0-9]{1,15})/ig, function(m){
			var screenname = m.substring(1);
			return '<a href="http://twitter.com/' + screenname + '" class="url screenname">' + m + '</a>';
		});
	},
	
	formatStatus: function(status, mode){
		// store into memory
		var stored = App.data.statuses[status.id];
		if (!stored) App.data.statuses[status.id] = status;
		
		var mention = new RegExp('\\B@' + App.data.credentials.screen_name + '\\b', 'ig').test(status.text);
		status._text = App.statusIfy(status.text);
		
		status._screenname = status.user.screen_name;
		status._screennameURL = 'http://twitter.com/' + status._screenname;
		status._name = status.user.name;
		status._avatar = status.user.profile_image_url.replace('https://', 'http://'); // HTTPS bug in Titanium win32
		status.inreply = (status.in_reply_to_status_id) ? '&rarr; ' + status.in_reply_to_screen_name : '';
		
		var html = '<a href="{_screennameURL}" class="avatar url screenname" style="background-image: url({_avatar})"></a>\
			<span class="body">\
				<span class="actions"></span>\
				<span class="front"><strong class="screenname"><a href="{_screennameURL}" class="url screenname" title="{_name}">{_screenname}</a></strong></span>\
				<span class="content">{_text}</span>\
				<span class="metadata">\
					<a href="{_screennameURL}/status/{id}" target="ti:systembrowser" class="url time external-url"><time title="{created_at}">{created_at}</time></a>\
					<a href="#{in_reply_to_status_id}" class="in-reply">{inreply}</a>\
				</span>\
			</span>'.substitute(status);
			
		var el = new Element('li', {
			'class': 'status id-' + status.id + ' u-' + status._screenname,
			html: html,
			tabindex: 0
		}).store('statusId', status.id);
		
		if (status.user.id != App.data.credentials.id && !stored) el.addClass('unread');
		if (mention) el.addClass('mention');
		if (mode) el.addClass(mode);
		
		return el;
	},
	
	formatMessage: function(message){
		message._text = App.statusIfy(message.text);
		message._screenname = message.sender_screen_name;
		message._screennameURL = 'http://twitter.com/' + message._screenname;
		message._name = message.sender.name;
		message._avatar = message.sender.profile_image_url.replace('https://', 'http://'); // HTTPS bug in Titanium win32

		var isSelf = (message._screenname == App.data.credentials.screen_name);
		
		message._recipient_screenname = message.recipient_screen_name;
		message._recipient_screennameURL = 'http://twitter.com/' + message._recipient_screenname;
		message._recipient_name = message.recipient.name;
		message._recipient_avatar = message.recipient.profile_image_url.replace('https://', 'http://');
		
		var html = '<a href="{_screennameURL}" class="avatar url screenname" style="background-image: url({_avatar})"></a>\
			<a href="{_recipient_screennameURL}" class="avatar recipient url screenname" style="background-image: url({_recipient_avatar})"></a>\
			<span class="body">\
				<span class="actions"></span>\
				<span class="front"><strong class="screenname"><a href="{_screennameURL}" class="url screenname" title="{_name}">{_screenname}</a></strong>\
				&rarr; <a href="{_recipient_screennameURL}" class="url screenname" title="{_recipient_name}">{_recipient_screenname}</a></span>\
				<span class="content">{text}</span>\
				<span class="metadata">\
					<a href="{_screennameURL}/status/{id}" class="url time external-url"><time title="{created_at}">{created_at}</time></a>\
				</span>\
			</span>'.substitute(message);
		
		var el = new Element('li', {
			id: 'message-' + message.id,
			'class': 'status message u-' + message._screenname,
			html: html,
			tabindex: 0
		}).store('messageId', message.id);
		
		el.addClass('unread');
		el.addClass((isSelf) ? 'sent' : 'received');
		
		return el;
	},
	
	setTimeDiffs: function(){
		$$('time').each(function(time){
			var t = time.retrieve('time');
			if (!t){
				var title = time.get('title');
				t = Date.parse(title);
				time.store('time', t);
				time.set('title', t.format('%b %d %I:%M %p'));
			}
			var timeDiff = t.timeDiffInWords();
			time.set('text', timeDiff);
		});
	},
	
	load: function(){
		App.initTheme();
		App.Home.init();
		App.Mentions.init();
		App.Messages.init();
	}
	
};

App.Home = {

	pollRate: 2*60000, // 2 mins
	tweetsLimit: 20,
	
	init: function(){
		App.Home.twoaMethod = 'statuses/friends_timeline';
		App.Home.section = $('home');
		App.Home.since_id = null;
		App.Home.request = null;
		App.Home.isUnloadOld = true; // set to unload old tweets or not
		App.Home.scroll = new Fx.Scroll(App.Home.section, {
			transition: Fx.Transitions.Cubic.easeInOut,
			duration: 'long',
			onStart: function(){
				App.freezeSUME = true;
			},
			onComplete: function(){
				App.freezeSUME = false;
			}
		});
		App.Home.load();
	},

	load: function(){
		var opts = {};
		App.Home.request = App.twoa.initMethod(App.Home.twoaMethod, {
			data: opts,
			onSuccess: function(data){
				if (data.length){
					App.Home.render(data);
					App.Home.since_id = data[0].id;
				}
				App.setTimeDiffs();
				App.Home.loadNew.delay(App.Home.pollRate);
			},
			onFailure: function(){
				App.Home.load.delay(App.Home.pollRate/2);
			}
		});
	},
	
	loadNew: function(){
		var opts = {
		};
		App.Home.request = App.twoa.initMethod(App.Home.twoaMethod, {
			data: $extend(opts, {since_id: App.Home.since_id}),
			onSuccess: function(data){
				if (data.length){
					App.Home.renderNew(data);
					App.Home.since_id = data[0].id;
				}
				App.setTimeDiffs();
				if (App.Home.isUnloadOld) App.Home.unloadOld();
				App.Home.loadNew.delay(App.Home.pollRate);
			},
			onFailure: function(){
				App.Home.loadNew.delay(App.Home.pollRate/2);
			}
		});
	},
	
	loadMore: function(max_id){
		App.Home.isUnloadOld = false;
		var opts = {
			max_id: max_id,
			count: 21 // 20 + 1 of the max id tweet
		};
		App.Home.request = App.twoa.initMethod(App.Home.twoaMethod, {
			data: opts,
			onSuccess: function(data){
				if (!data.length) return;
				App.Home.renderMore(data.slice(1)); // minus the max id tweet
				App.setTimeDiffs();
				App.Home.isUnloadOld = true;
				App.Home.moreLink.fade('show');
				App.Home.moreLinkBusy = false;
			},
			onFailure: function(){
				App.Home.isUnloadOld = true;
				App.Home.moreLink.fade('in');
			}
		});
	},
	
	unloadOld: function(){
		var statuses = App.Home.section.getElements('ol.main>.status');
		if (statuses.length <= 20) return;
		var leftovers = new Elements(statuses.slice(20));
		var leftInViews = leftovers.filter(':inView');
		var els = (leftInViews.length) ? leftInViews.getLast().getAllNext('.status') : leftovers;
		els.destroy();
	},
	
	render: function(data){
		var section = App.Home.section;
		
		var ol = new Element('ol', {'class': 'main'}).inject(section);
		
		var tweets = data.map(function(tweet){
			return App.formatStatus(tweet);
		}).reverse();
		tweets.each(function(el){
			el.inject(ol, 'top');
		});
		
		App.Home.moreLinkBusy = false;
		App.Home.moreLink = new Element('a', {
			'class': 'more',
			href: '#',
			text: 'more',
			events: {
				click: function(e){
					e.stop();
					if (App.Home.moreLinkBusy) return;
					App.Home.moreLinkBusy = true;
					App.Home.moreLink.fade(0.4);
					var max_id = section.getElement('ol.main>.status:last-child').retrieve('statusId');
					console.log(max_id);
					App.Home.loadMore(max_id);
				}
			}
		}).inject(ol, 'after');
		
		App.Home.scroll.toBottom();
	},
	
	renderNew: function(data){
		var section = App.Home.section;
		
		var ol = section.getElement('ol');
		
		var scrollY = section.getScroll().y;
		var y = ol.getStyle('padding-top').toInt();
		var tweets = data.map(function(tweet){
			return App.formatStatus(tweet);
		}).reverse();
		tweets.each(function(el){
			el.inject(ol, 'top');
			y += el.getFullSize().y;
		});
		section.scrollTo(0, scrollY + y);
		
		if (scrollY == 0) App.Home.scroll.toTop();
	},
	
	renderMore: function(data){
		var section = App.Home.section;
		
		var ol = section.getElement('ol');
		
		var firstEl = null;
		data.each(function(tweet){
			var el = App.formatStatus(tweet);
			el.inject(ol);
			if (!firstEl) firstEl = el;
		});
		
		App.Home.scroll.toElement(firstEl.getPrevious('.status'));
	}
	
};

App.Mentions = {

	pollRate: 5*60000, // 5 mins
	tweetsLimit: 20,
	
	init: function(){
		App.Mentions.twoaMethod = 'statuses/mentions';
		App.Mentions.section = $('mentions');
		App.Mentions.since_id = null;
		App.Mentions.request = null;
		App.Mentions.isUnloadOld = true; // set to unload old tweets or not
		App.Mentions.scroll = new Fx.Scroll(App.Mentions.section, {
			transition: Fx.Transitions.Cubic.easeInOut,
			duration: 'long',
			onStart: function(){
				App.freezeSUME = true;
			},
			onComplete: function(){
				App.freezeSUME = false;
			}
		});
		App.Mentions.load();
	},

	load: function(){
		var opts = {};
		App.Mentions.request = App.twoa.initMethod(App.Mentions.twoaMethod, {
			data: opts,
			onSuccess: function(data){
				if (data.length){
					App.Mentions.render(data);
					App.Mentions.since_id = data[0].id;
				}
				App.setTimeDiffs();
				App.Mentions.loadNew.delay(App.Mentions.pollRate);
			},
			onFailure: function(){
				App.Mentions.load.delay(App.Mentions.pollRate/2);
			}
		});
	},
	
	loadNew: function(){
		var opts = {
		};
		App.Mentions.request = App.twoa.initMethod(App.Mentions.twoaMethod, {
			data: $extend(opts, {since_id: App.Mentions.since_id}),
			onSuccess: function(data){
				if (data.length){
					App.Mentions.renderNew(data);
					App.Mentions.since_id = data[0].id;
				}
				App.setTimeDiffs();
				if (App.Mentions.isUnloadOld) App.Mentions.unloadOld();
				App.Mentions.loadNew.delay(App.Mentions.pollRate);
			},
			onFailure: function(){
				App.Mentions.loadNew.delay(App.Mentions.pollRate/2);
			}
		});
	},
	
	loadMore: function(max_id){
		App.Mentions.isUnloadOld = false;
		var opts = {
			max_id: max_id,
			count: 21 // 20 + 1 of the max id tweet
		};
		App.Mentions.request = App.twoa.initMethod(App.Mentions.twoaMethod, {
			data: opts,
			onSuccess: function(data){
				if (!data.length) return;
				App.Mentions.renderMore(data.slice(1)); // minus the max id tweet
				App.setTimeDiffs();
				App.Mentions.isUnloadOld = true;
				App.Mentions.moreLink.fade('show');
				App.Mentions.moreLinkBusy = false;
			},
			onFailure: function(){
				App.Mentions.isUnloadOld = true;
				App.Mentions.moreLink.fade('in');
			}
		});
	},
	
	unloadOld: function(){
		var statuses = App.Mentions.section.getElements('ol.main>.status');
		if (statuses.length <= 20) return;
		var leftovers = new Elements(statuses.slice(20));
		var leftInViews = leftovers.filter(':inView');
		var els = (leftInViews.length) ? leftInViews.getLast().getAllNext('.status') : leftovers;
		els.destroy();
	},
	
	render: function(data){
		var section = App.Mentions.section;
		
		var ol = new Element('ol', {'class': 'main'}).inject(section);
		
		var tweets = data.map(function(tweet){
			return App.formatStatus(tweet);
		}).reverse();
		tweets.each(function(el){
			el.inject(ol, 'top');
		});
		
		App.Mentions.moreLinkBusy = false;
		App.Mentions.moreLink = new Element('a', {
			'class': 'more',
			href: '#',
			text: 'more',
			events: {
				click: function(e){
					e.stop();
					if (App.Mentions.moreLinkBusy) return;
					App.Mentions.moreLinkBusy = true;
					App.Mentions.moreLink.fade(0.4);
					var max_id = section.getElement('ol.main>.status:last-child').retrieve('statusId');
					console.log(max_id);
					App.Mentions.loadMore(max_id);
				}
			}
		}).inject(ol, 'after');
		
//		App.Mentions.scroll.toBottom();
	},
	
	renderNew: function(data){
		var section = App.Mentions.section;
		
		var ol = section.getElement('ol');
		
		var scrollY = section.getScroll().y;
		var y = ol.getStyle('padding-top').toInt();
		var tweets = data.map(function(tweet){
			return App.formatStatus(tweet);
		}).reverse();
		tweets.each(function(el){
			el.inject(ol, 'top');
			y += el.getFullSize().y;
		});
		section.scrollTo(0, scrollY + y);
		
		if (scrollY == 0) App.Mentions.scroll.toTop();
	},
	
	renderMore: function(data){
		var section = App.Mentions.section;
		
		var ol = section.getElement('ol');
		
		var firstEl = null;
		data.each(function(tweet){
			var el = App.formatStatus(tweet);
			el.inject(ol);
			if (!firstEl) firstEl = el;
		});
		
		App.Mentions.scroll.toElement(firstEl.getPrevious('.status'));
	}
	
};

App.Messages = {

	pollRate: 5*60000, // 5 mins
	tweetsLimit: 20,
	
	init: function(){
		App.Messages.twoaMethod1 = 'direct_messages';
		App.Messages.twoaMethod2 = 'direct_messages/sent';
		App.Messages.section = $('messages');
		App.Messages.received_since_id = null;
		App.Messages.sent_since_id = null;
		App.Messages.request = null;
		App.Messages.isUnloadOld = true; // set to unload old tweets or not
		App.Messages.scroll = new Fx.Scroll(App.Messages.section, {
			transition: Fx.Transitions.Cubic.easeInOut,
			duration: 'long',
			onStart: function(){
				App.freezeSUME = true;
			},
			onComplete: function(){
				App.freezeSUME = false;
			}
		});
		App.Messages.load();
	},
	
	merge: function(received_data, sent_data){
		return [].extend(received_data).extend(sent_data).sort(function(a, b){
			var a_date = Date.parse(a.created_at);
			var b_date = Date.parse(b.created_at);
			return a_date.diff(b_date, 'second');
		});
	},

	load: function(){
		var opts = {};
		App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod1, {
			data: opts,
			onSuccess: function(received_data){
				if (App.Messages.sent_since_id) $extend(opts, {since_id: App.Messages.sent_since_id});
				App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod2, {
					data: opts,
					onSuccess: function(sent_data){
						if (received_data.length || sent_data.length){
							App.Messages.render(received_data, sent_data);
							App.Messages.received_since_id = received_data[0].id;
							App.Messages.sent_since_id = sent_data[0].id;
						}
						App.setTimeDiffs();
						App.Messages.loadNew.delay(App.Messages.pollRate);
					},
					onFailure: function(){
						App.Messages.load.delay(App.Messages.pollRate/2);
					}
				});
			},
			onFailure: function(){
				App.Messages.load.delay(App.Messages.pollRate/2);
			}
		});
	},
	
	loadNew: function(){
		var opts = {
		};
		App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod1, {
			data: $extend(opts, {since_id: App.Messages.received_since_id}),
			onSuccess: function(received_data){
				App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod2, {
					data: $extend(opts, {since_id: App.Messages.sent_since_id}),
					onSuccess: function(sent_data){
						if (received_data.length || sent_data.length){
							App.Messages.renderNew(received_data, sent_data);
							App.Messages.received_since_id = received_data[0].id;
							App.Messages.sent_since_id = sent_data[0].id;
						}
						App.setTimeDiffs();
						if (App.Messages.isUnloadOld) App.Messages.unloadOld();
						App.Messages.loadNew.delay(App.Messages.pollRate);
					},
					onFailure: function(){
						App.Messages.loadNew.delay(App.Messages.pollRate/2);
					}
				});
			},
			onFailure: function(){
				App.Messages.loadNew.delay(App.Messages.pollRate/2);
			}
		});
	},
	
	loadMore: function(received_max_id, sent_max_id){
		App.Messages.isUnloadOld = false;
		var opts = {
			max_id: received_max_id,
			count: 21 // 20 + 1 of the max id tweet
		};
		App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod1, {
			data: opts,
			onSuccess: function(received_data){
				App.Messages.request = App.twoa.initMethod(App.Messages.twoaMethod2, {
					data: $extend(opts, {max_id: sent_max_id}),
					onSuccess: function(sent_data){
						if (received_data.length || sent_data.length){
							App.Messages.renderMore(received_data.slice(1), sent_data.slice(1)); // minus the max id tweet
						}
						App.setTimeDiffs();
						App.Messages.isUnloadOld = true;
						App.Messages.moreLink.fade('show');
						App.Messages.moreLinkBusy = false;
					},
					onFailure: function(){
						App.Messages.isUnloadOld = true;
						App.Messages.moreLink.fade('in');
					}
				});
			},
			onFailure: function(){
				App.Messages.isUnloadOld = true;
				App.Messages.moreLink.fade('in');
			}
		});
	},
	
	unloadOld: function(){
		var statuses = App.Messages.section.getElements('ol.main>.status');
		if (statuses.length <= 20) return;
		var leftovers = new Elements(statuses.slice(20));
		var leftInViews = leftovers.filter(':inView');
		var els = (leftInViews.length) ? leftInViews.getLast().getAllNext('.status') : leftovers;
		els.destroy();
	},
	
	render: function(received_data, sent_data){
		var section = App.Messages.section;
		
		var ol = new Element('ol', {'class': 'main'}).inject(section);
		
		var data = App.Messages.merge(received_data, sent_data);
		
		var messages = data.map(function(message){
			return App.formatMessage(message)
		}).reverse();
		messages.each(function(el){
			el.inject(ol, 'top');
		});
		
		App.Messages.moreLinkBusy = false;
		App.Messages.moreLink = new Element('a', {
			'class': 'more',
			href: '#',
			text: 'more',
			events: {
				click: function(e){
					e.stop();
					if (App.Messages.moreLinkBusy) return;
					App.Messages.moreLinkBusy = true;
					App.Messages.moreLink.fade(0.4);
					var received_max_id = section.getElement('ol.main>.status.received:last-child').retrieve('messageId');
					var sent_max_id = section.getElement('ol.main>.status.sent:last-child').retrieve('messageId');
					console.log(received_max_id);
					console.log(sent_max_id);
					App.Messages.loadMore(received_max_id, sent_max_id);
				}
			}
		}).inject(ol, 'after');
		
//		App.Messages.scroll.toBottom();
	},
	
	renderNew: function(received_data, sent_data){
		var section = App.Messages.section;
		
		var ol = section.getElement('ol');
		
		var scrollY = section.getScroll().y;
		var y = ol.getStyle('padding-top').toInt();
		
		var data = App.Messages.merge(received_data, sent_data);
		
		var messages = data.map(function(message){
			return App.formatMessage(message);
		}).reverse();
		messages.each(function(el){
			el.inject(ol, 'top');
			y += el.getFullSize().y;
		});
		section.scrollTo(0, scrollY + y);
		
		if (scrollY == 0) App.Messages.scroll.toTop();
	},
	
	renderMore: function(received_data, sent_data){
		var section = App.Messages.section;
		
		var ol = section.getElement('ol');
		
		var firstEl = null;
		
		var data = App.Messages.merge(received_data, sent_data);
		data.each(function(message){
			var el = App.formatMessage(message);
			el.inject(ol);
			if (!firstEl) firstEl = el;
		});
		
		App.Messages.scroll.toElement(firstEl.getPrevious('.status'));
	}
	
};

(function(){

	// assume that there will be no 'future' tweets. Or to say, impossible.
	var justNow = 'just now';

	MooTools.lang.set('en-US', 'Date', {

		lessThanMinuteAgo: 'few seconds ago',
		minuteAgo: 'a minute ago',
		minutesAgo: '{delta} minutes ago',
		hourAgo: 'an hour ago',
		hoursAgo: '{delta} hours ago',
		dayAgo: '1 day ago',
		daysAgo: '{delta} days ago',
		lessThanMinuteUntil: justNow,
		minuteUntil: justNow,
		minutesUntil: justNow,
		hourUntil: justNow,
		hoursUntil: justNow,
		dayUntil: justNow,
		daysUntil: justNow

	});

})();

window.addEvent('domready', function(){
	//*
	App.init.delay(5000); // debug
	/*/
	App.init();
	//*/
});