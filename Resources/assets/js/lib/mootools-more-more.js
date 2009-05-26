Element.implement({

	/*
		Element.inView, determine if element is in view or not.
	*/

	inView: function() {
		var scroll = window.getScroll();
		var size = window.getSize();
		var right = scroll.x + size.x;
		var bottom = scroll.y + size.y;
		var coords = this.getCoordinates();

		return (
			(coords.left >= scroll.x && coords.left <= right) ||
			(coords.right >= scroll.x && coords.right <= right) ||
			(coords.left <= scroll.x && coords.right >= right)
		) && (
			(coords.top >= scroll.y && coords.top <= bottom) ||
			(coords.bottom >= scroll.y && coords.bottom <= bottom) ||
			(coords.top <= scroll.y && coords.bottom >= bottom)
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

Selectors.Pseudo.inView = function(){
	return this.inView();
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
