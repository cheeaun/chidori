Element.implement({

	/*
		Restoring the old getOffsets from 1.2.2
	*/

	getOffsets: function(){
		if (Browser.Engine.trident){
			var bound = this.getBoundingClientRect(), html = this.getDocument().documentElement;
			var isFixed = styleString(this, 'position') == 'fixed';
			return {
				x: bound.left + ((isFixed) ? 0 : html.scrollLeft) - html.clientLeft,
				y: bound.top +  ((isFixed) ? 0 : html.scrollTop)  - html.clientTop
			};
		}
		
		var styleString = Element.getComputedStyle;
		
		function styleNumber(element, style){
			return styleString(element, style).toInt() || 0;
		};
		
		function topBorder(element){
			return styleNumber(element, 'border-top-width');
		};
		
		function leftBorder(element){
			return styleNumber(element, 'border-left-width');
		};
		
		function isBody(element){
			return (/^(?:body|html)$/i).test(element.tagName);
		};

		var element = this, position = {x: 0, y: 0};
		if (isBody(this)) return position;

		while (element && !isBody(element)){
			position.x += element.offsetLeft;
			position.y += element.offsetTop;

			if (Browser.Engine.gecko){
				if (!borderBox(element)){
					position.x += leftBorder(element);
					position.y += topBorder(element);
				}
				var parent = element.parentNode;
				if (parent && styleString(parent, 'overflow') != 'visible'){
					position.x += leftBorder(parent);
					position.y += topBorder(parent);
				}
			} else if (element != this && Browser.Engine.webkit){
				position.x += leftBorder(element);
				position.y += topBorder(element);
			}

			element = element.offsetParent;
		}
		if (Browser.Engine.gecko && !borderBox(this)){
			position.x -= leftBorder(this);
			position.y -= topBorder(this);
		}
		return position;
	},

	/*
		Element.isViewable, determine if element is in view or not.
	*/
	
	isViewable: function(){
		var offsetParent = this.getOffsetParent();
		if (!offsetParent) return true;
		var scroll = offsetParent.getScroll();
		var size = offsetParent.getSize();
		var left = scroll.x;
		var top = scroll.y;
		var right = left + size.x;
		var bottom = top + size.y;
		/*
		var left = 0, top = 0;
		var right = size.x;
		var bottom = size.y;
		if (/^(?:body|html)$/i.test(offsetParent.tagName)){ //isBody
			right += left = scroll.x;
			bottom += top = scroll.y;
		}
		*/
		var coords = this.getCoordinates(offsetParent);
		return (
			(coords.left >= left && coords.left <= right) ||
			(coords.right >= left && coords.right <= right) ||
			(coords.left <= left && coords.right >= right)
		) && (
			(coords.top >= top && coords.top <= bottom) ||
			(coords.bottom >= top && coords.bottom <= bottom) ||
			(coords.top <= top && coords.bottom >= bottom)
		);
	},
	
	/*
		Element.toggleReveal, the missing function in Fx.Reveal :)
	*/
	
	toggleReveal: function(options){
		this.get('reveal', options).toggle();
		return this;
	},
	
	/*
		Element.getFullSize, combines getSize with margins.
	*/
	
	getFullSize: function(){
		return {
			x: this.getSize().x + this.getStyle('margin-left').toInt() + this.getStyle('margin-right').toInt(),
			y: this.getSize().y + this.getStyle('margin-top').toInt() + this.getStyle('margin-bottom').toInt()
		};
	}
	
});

/*
	Selector pseudo for Element.inView
*/

Selectors.Pseudo.viewable = function(){
	return this.isViewable();
};

/*
	Patch for Request Class, due to Twitter's stupid content-type header
*/

Request.implement({

	processScripts: function(text){
		if (this.options.evalResponse) return $exec(text);
		return text.stripScripts(this.options.evalScripts);
	}
	
});
