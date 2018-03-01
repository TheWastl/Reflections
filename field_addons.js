var col;
window.onload = function() {
	col = document.getElementById('zero');
	col.className = undefined;
	window.setTimeout(function(){col.className = 'zero'},0);
}
