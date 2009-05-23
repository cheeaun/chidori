/*
	Element.inView
*/

Element.implement({

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
	}

});

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

/*
	Element.toggleReveal
*/

Element.implement({

	toggleReveal: function(options){
		this.get('reveal', options).toggle();
		return this;
	}

});