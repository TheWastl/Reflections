var codearea, codediv, codeinfo, output, form, slow, table, speed, eof, inputia, inputiadiv, input, inputdiv, inputbuf, ia, permalink, preset, button;

const fieldsep = "\xff";

var $ = n=>document.getElementById(n);

function init() {
	codearea = $('code');
	codearea.onclick = function() {
		if (interval)  {
			codearea.value = code.join("\n");
			codearea.focus();
			codearea.selectionStart = pos.y * (width + 1) + pos.x;
			codearea.selectionEnd = codearea.selectionStart + 1;
		}
	};
	codearea.onfocusout = codearea.onclick;
	codearea.readOnly = false;
	codearea.oninput = function() {
		codeinfo.innerText = codearea.value.length+' byte'+
		  (codearea.value.length == 1 ? '' : 's');
		gen_link();
		resize(codearea);
	};
	codediv = codearea.parentElement;
	codeinfo = $('code-info');
	table = { table: $('stacks') };
	table.colgroup = document.createElement('colgroup');
	table.table.appendChild(table.colgroup);
	table.colgroup.appendChild(document.createElement('col'));
	table.col = 0;
	table.rows = new Array(11);
	table.values = [];
	add_col();
	add_col();
	var header;
	for (var i = 0; i < 13; i++) {
		table.rows[i] = document.createElement('tr');
		table.table.appendChild(table.rows[i]);
		switch(i) {
			case 0: header = 'S:'; break;
			case 11: header = 'R:'; break;
			case 12: header = 'A:'; break;
			default: header = (i-1)+':'; break;
		}
		add_val(i, 'h', header);
	}
	table.values = [];
	output = $('output');
	ia = $('interactive');
	ia.oninput = ia_input;
	ia.onclick = ia.oninput;
	input = $('input');
	input.oninput = function() {
		gen_link();
		resize(input);
	};
	inputdiv = input.parentElement;
	inputia = $('input-ia');
	inputia.onkeydown = read;
	inputiadiv = inputia.parentElement;
	inputiadiv.hidden = true;
	eof = $('eof');
	eof.onclick = send_eof;
	slow = $('slow');
	slow.disabled = false;
	slow.oninput = disable_speed;
	slow.onclick = slow.oninput;
	speed = $('speed');
	speed.oninput = gen_link;
	$('preset').onchange = function() {
		decode_link(this.value);
		this.value='';
	}
	button = $('main-button');
	button.onclick = click;
	$('permacopy').onclick = function() {
		permalink.select();
		document.execCommand('copy');
	};
	permalink = $('permalink');
	decode_link(location.hash);
	window.addEventListener('keydown', keypress);
	resize(codearea);
	resize(input);
	resize(output);
}

const	D_NORTH = 0, // direction values
	D_EAST = 1,
	D_SOUTH = 2,
	D_WEST = 3,

	D_LEFT = 3,
	D_RIGHT = 1,
	D_BACK = 2;

const zero = '0'.charCodeAt(0); // charcode of 0

const	ST_UNDERFLOW = 'Stack underflow', // error msgs
	NUM_NOT_FOUND = 'Number not found';

var code_start, code;
var pos, origin, direction, mainstack, stacks, width;
var interval;
var reading;

function click(evt) {
	if (interval) end();
	else start();
}

function keypress(evt) {
	if (evt.keyCode == 13 && evt.ctrlKey) start();
	else if (evt.keyCode == 27 && interval) end();
}

function start() {
	if (interval) return;
	empty_table();
	output.value = '';
	resize(output)
	pos = { x: -1, y: 0 };
	origin = { x: 0, y: 0 };
	direction = D_EAST;
	mainstack = [];
	stacks = new Array(10);
	for(var i = 0; i < 10; i++) stacks[i] = [];
	slow.disabled = true;
	speed.disabled = true;
	ia.disabled = true;
	code_start = codearea.value;
	codearea.readOnly = true;
	code = code_start.split("\n");
	if (!code.length) return;
	width = code.reduce(function(a, b) {
		if (a.length > b.length) return a;
		return b;
	}).length;
	code = code.map(function(val) {
		for(var i = val.length; i < this.width; i++) val += ' ';
		return val;
	}, { width: width });
	table.table.hidden = !slow.checked;
	codediv.style.width = slow.checked ? '50%' : '100%';
	if (!ia.checked) {
		inputbuf = input.value.split("\n");
		input.readOnly = true;
	}
	run();
}

function step() {
	move();
	if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= code.length)
	  return end();
	codearea.onclick();
	var a = 0, b, c, d;
	switch(code[pos.y].charAt(pos.x)) {
		case '/':
			if (direction == D_NORTH) direction = D_EAST;
			else if (direction == D_EAST) direction = D_NORTH;
			else if (direction == D_SOUTH) direction = D_WEST;
			else if (direction == D_WEST) direction = D_SOUTH;
			break;
		case '\\':
			if (direction == D_NORTH) direction = D_WEST;
			else if (direction == D_EAST) direction = D_SOUTH;
			else if (direction == D_SOUTH) direction = D_EAST;
			else if (direction == D_WEST) direction = D_NORTH;
			break;
		case '|':
			if (direction == D_WEST) direction = D_EAST;
			else if (direction == D_EAST) direction = D_WEST;
			break;
		case '-':
			if (direction == D_NORTH) direction = D_SOUTH;
			else if (direction == D_SOUTH) direction = D_NORTH;
			break;
		case '^': a = D_RIGHT;
		case '<': a += D_RIGHT;
		case 'v': a += D_RIGHT;
		case '>': a = (D_EAST + a) % 4;
			if (direction == a) return end();
			if (direction == (a + D_BACK) % 4) {
				if (mainstack.pop()) direction += D_RIGHT;
				else direction += D_LEFT;
				direction %= 4;
			} else direction = a;
			break;
		case 'X': return end();
		case '?': direction =
			  (direction + Math.floor(Math.random() * 3) + 1) % 4;
			break;
		case '~': mainstack.push(mainstack.length);
			break;
		case '=': move();
			a = code[pos.y].charCodeAt(pos.x) - zero;
			if (a < 0 || a > 9)
			  return error(NUM_NOT_FOUND);
			mainstack = stacks[a].slice(0);
			break;
		case '#': origin.x = pos.x;
			origin.y = pos.y;
			break;
		case '+': mainstack.push(pos.x-origin.x+pos.y-origin.y);
			break;
		case '*': mainstack.push((pos.x-origin.x)*(pos.y-origin.y));
			break;
		case ':': if (!mainstack.length) return error(ST_UNDERFLOW);
			mainstack.push(mainstack[mainstack.length-1]);
			break;
		case ';': if (!mainstack.length) return error(ST_UNDERFLOW);
			mainstack.pop();
			break;
		case '(': a = pos.x+1;
			if (a >= width) return error(NUM_NOT_FOUND);
			b = code[pos.y].charCodeAt(a)-zero;
			if (b < 0 || b > 9) return error(NUM_NOT_FOUND);
			if (!mainstack.length) return error(ST_UNDERFLOW);
			stacks[b].push(mainstack.pop());
			if (direction == D_EAST) pos.x = a;
			break;
		case ')': a = pos.x-1;
			if (a < 0) return error(NUM_NOT_FOUND);
			b = code[pos.y].charCodeAt(a)-zero;
			if (b < 0 || b > 9) return error(NUM_NOT_FOUND);
			if (!stacks[b].length) return error(ST_UNDERFLOW);
			mainstack.push(stacks[b].pop());
			if (direction == D_WEST) pos.x = a;
			break;
		case '_': a = get_func();
			if (a == -1) return false;
			b = num_args[a];
			if (b > mainstack.length) return error(ST_UNDERFLOW);
			if (!exec_func(a,
			  b ? mainstack.splice(-b).reverse() : []))
			    return false;
			break;
		case '@': if (!repeat_func()) return false;
			break;
		default: a = code[pos.y].charCodeAt(pos.x) - zero;
			if (a < 0 || a > 9
			  || (direction == D_EAST && pos.x+1 < width &&
				code[pos.y].charAt(pos.x+1) == ')')
			  || (direction == D_WEST && pos.x > 0 &&
				code[pos.y].charAt(pos.x-1) == '(')) break;
			b = mainstack;
			mainstack = stacks[a];
			stacks[a] = b;
			break;
	}
	if (interval) {
		empty_table();
		show_stack(mainstack, 0);
		for(var i = 0; i < 10; i++) show_stack(stacks[i], i+1);
		add_val(11, 'h', 'X');
		add_val(11, 'd', pos.x-origin.x);
		add_val(11, 'h', 'Y');
		add_val(11, 'd', pos.y-origin.y);
		add_val(12, 'h', 'X');
		add_val(12, 'd', pos.x);
		add_val(12, 'h', 'Y');
		add_val(12, 'd', pos.y);
	}
	return true;
}

function empty_table() {
	table.values.forEach(function(val) { val.remove(); });
	table.values = [];
}

function show_stack(stack, row) {
	var value;
	for(var i = stack.length-1; i >= 0; i--) {
		if (i >= table.col) add_col();
		add_val(row, 'd', stack[i]);
		if (stack[i] == 128) value = 'DEL';
		else if (stack[i] >= 0 && stack[i] < 128) {
			if (stack[i] >= 32) value =
			  "'"+String.fromCharCode(stack[i])+"'";
			else switch(stack[i]) {
				case 0: value = "'\\0'"; break;
				case 1: value = 'SOH'; break;
				case 2: value = 'STX'; break;
				case 3: value = 'ETX'; break;
				case 4: value = 'EOT'; break;
				case 5: value = 'ENQ'; break;
				case 6: value = 'ACK'; break;
				case 7: value = "'\\a'"; break;
				case 8: value = "'\\b'"; break;
				case 9: value = "'\\t'"; break;
				case 10: value = "'\\n'"; break;
				case 11: value = "'\\v'"; break;
				case 12: value = "'\\f'"; break;
				case 13: value = "'\\r'"; break;
				case 14: value = 'SO'; break;
				case 15: value = 'SI'; break;
				case 16: value = 'DLE'; break;
				case 17: value = 'DC1'; break;
				case 18: value = 'DC2'; break;
				case 19: value = 'DC3'; break;
				case 20: value = 'DC4'; break;
				case 21: value = 'NAK'; break;
				case 22: value = 'SYN'; break;
				case 23: value = 'ETB'; break;
				case 24: value = 'CAN'; break;
				case 25: value = 'EM'; break;
				case 26: value = 'SUB'; break;
				case 27: value = 'ESC'; break;
				case 28: value = 'FS'; break;
				case 29: value = 'GS'; break;
				case 30: value = 'RS'; break;
				case 31: value = 'US'; break;
			}
		} else value = '';
		add_val(row, 'd', value);
	}
}

function add_val(row, type, val) {
	var value = document.createElement('t'+type);
	value.innerText = String(val);
	table.rows[row].appendChild(value);
	table.values.push(value);
}

function add_col() {
	var col = document.createElement('col');
	col.className = 'stack_num';
	table.colgroup.appendChild(col);
	col = document.createElement('col');
	col.className = 'stack_ascii';
	table.colgroup.appendChild(col);
	table.col++;
}

function repeat_func() {
	var f = get_func();
	if (f == -1) return false;
	var n = num_args[f];
	if (!mainstack.length) return error(ST_UNDERFLOW);
	var l = mainstack.pop();
	var args = new Array(n);
	var varargs = [];
	var i;
	for(i = 0; i < n; i++) {
		if ((l >> i) & 1) varargs.push(i);
		else if (mainstack.length) args[i] = mainstack.pop();
		else return error(ST_UNDERFLOW);
	}
	var oldstack = mainstack;
	var fullmainstack = [];
	if (!varargs.length) {
		if (!oldstack.length) return error(ST_UNDERFLOW);
		l = args.shift();
		args.push(oldstack.pop());
		while(l) {
			mainstack = [];
			exec_func(f, args);
			fullmainstack = mainstack.concat(fullmainstack);
			l--;
		}
		mainstack = fullmainstack;
		return true;
	}
	for(l = Math.floor(oldstack.length / varargs.length); l; l--) {
		mainstack = [];
		for(i = 0; i < varargs.length; i++) args[i] = oldstack.pop();
		if (!exec_func(f, args)) return false;
		fullmainstack = mainstack.concat(fullmainstack);
	}
	mainstack = fullmainstack;
	return true;
}

function get_func() {
	var a, x = pos.x-origin.x, y = pos.y-origin.y;
	if (y >= 0) a = 0;
	else {
		a = 2;
		y = -y-1;
	}
	if (x < 0) {
		a++;
		x = -x-1;
	}
	if (y >= field[a].length || x >= field[a][y].length ||
	  field[a][y][x] == -1) {
		error('No function at that position:');
		return -1;
	}
	return field[a][y][x];
}

function exec_func(f, args) {
	var tmp;
	switch(f) {
		case F_PRINT:
			if (args[0] < 0 || args[0] >= 128)
			  return error('No ASCII character: '+args[0]);
			output.value += String.fromCharCode(args[0]);
			resize(output)
			break;
		case F_READ:
			if (ia.checked) {
				if (interval) clearInterval(interval);
				inputia.value = '';
				inputiadiv.hidden = false;
				inputia.focus();
				reading = true;
				return false;
			} else {
				tmp = inputbuf.shift();
				if (tmp === undefined) mainstack.push(0);
				else push_string(tmp);
			}
			break;
		case F_ADD: mainstack.push(args[0] + args[1]);
			break;
		case F_MULTIPLY: mainstack.push(args[0] * args[1]);
			break;
		case F_SUBTRACT: mainstack.push(args[0] - args[1]);
			break;
		case F_DIVIDE: if (args[1] == 0) return error('Bad divisor');
			mainstack.push(Math.floor(args[0] / args[1]));
			break;
		case F_MOD: mainstack.push(args[0] % args[1]);
			break;
		case F_POWER: mainstack.push(Math.pow(args[0], args[1]));
			break;
		case F_ABS: mainstack.push(Math.abs(args[0]));
			break;
		case F_SQRT: if (args[0] < 0) return error('Bad radicand');
			mainstack.push(Math.floor(Math.sqrt(args[0])));
			break;
		case F_LT: mainstack.push(Number(args[0] < args[1]));
			break;
		case F_EQ: mainstack.push(Number(args[0] == args[1]));
			break;
		case F_GT: mainstack.push(Number(args[0] > args[1]));
			break;
		case F_LAND: mainstack.push(Number(args[0] && args[1]));
			break;
		case F_LNOT: mainstack.push(Number(!args[0]));
			break;
		case F_LOR: mainstack.push(Number(args[0] || args[1]));
			break;
		case F_LXOR:
			args[0] = Boolean(args[0]);
			args[1] = Boolean(args[1]);
			mainstack.push(Number(
			  (args[0] && !args[1]) || (!args[0] && args[1])));
			break;
		case F_BAND: mainstack.push(args[0] & args[1]);
			break;
		case F_BNOT: mainstack.push(~args[0] & ((1 << args[1]) - 1));
			break;
		case F_BOR: mainstack.push(args[0] | args[1]);
			break;
		case F_BXOR: mainstack.push(args[0] ^ args[1]);
			break;
		case F_LSHIFT: mainstack.push(args[0] << args[1]);
			break;
		case F_RSHIFT: mainstack.push(args[0] >> args[1]);
			break;
		case F_UC: mainstack.push(String.fromCharCode(args[0]).
			  toUpperCase().charCodeAt(0));
			break;
		case F_LC: mainstack.push(String.fromCharCode(args[0]).
			  toLowerCase().charCodeAt(0));
			break;
		case F_NUM2STR: push_string(String(args[0]));
			break;
		case F_STR2NUM: tmp = args[0] - zero;
			if (tmp < 0 || tmp > 9) mainstack.push(-1);
			else mainstack.push(tmp);
			break;
		case F_QUINE: push_string(code_start);
			break;
		case F_TIME: mainstack.push(Math.floor(Date.now() / 1000));
			break;
		case F_PROCESS_TIME: tmp = new Date(args[0] * 1000);
			switch(args[1]) {
				case 1: mainstack.push(tmp.getFullYear());
					break;
				case 2: mainstack.push(tmp.getMonth());
					break;
				case 3: mainstack.push(tmp.getDate());
					break;
				case 4: mainstack.push(tmp.getDay());
					break;
				case 5: mainstack.push(tmp.getHours());
					break;
				case 6: mainstack.push(tmp.getMinutes());
					break;
				case 7: mainstack.push(tmp.getSeconds());
					break;
				default: push_string(tmp.toString());
					break;
			}
			break;
	}
	return true;
}

function push_string(str) {
	mainstack = mainstack.concat(str.split('').
	  map(function(str) { return str.charCodeAt(0); }).reverse());
}

function read(evt) {
	if (reading && (evt.key == 'Enter' || evt.keyCode == 13)) {
		reading = false;
		push_string(inputia.value);
		inputiadiv.hidden = true;
		run();
	}
}

function send_eof() {
	if (reading) {
		reading = false;
		mainstack.push(0);
		inputiadiv.hidden = true;
		run();
	}
}

function run() {
	if (slow.checked || interval) {
		button.innerText = 'Stop (Escape)';
		interval = window.setInterval(step, speed.value);
		step();
	} else while(step());
}

function move() {
	switch (direction) {
		case D_NORTH: pos.y--; break;
		case D_EAST: pos.x++; break;
		case D_SOUTH: pos.y++; break;
		case D_WEST: pos.x--; break;
	}
}

function end() {
	if (interval) {
		clearInterval(interval);
		interval = 0;
		codearea.value = code_start;
		button.innerText = 'Run (Ctrl-Enter)';
	}
	if (reading) {
		inputia.hidden = true;
		reading = false;
	}
	slow.disabled = false;
	disable_speed();
	ia.disabled = false;
	codearea.readOnly = false;
	input.readOnly = false;
	return false;
}

function error(msg) {
	end();
	alert('Error: '+msg+'\nRelative: ('+(pos.x-origin.x)+'|'+
	  (pos.y-origin.y)+')\nAbsolute: ('+pos.x+'|'+pos.y+')');
	return false;
}

function disable_speed() {
	speed.disabled = !slow.checked;
	gen_link();
}

function ia_input() {
	inputdiv.style.display = ia.checked ? 'none' : '';
	gen_link();
}

function gen_link() {
	permalink.value = location.href.split('#')[0]+'##'+
	  btoa([ codearea.value, Number(slow.checked), speed.value, Number(ia.checked), input.value ]
	  .map(elem=>unescape(encodeURIComponent(elem))).join(fieldsep));
}

function decode_link(hash) {
	if (hash.match(/^##/)) {
		fields = atob(hash.substr(2)).split(fieldsep).map(elem=>decodeURIComponent(escape(elem)));
		codearea.value = fields[0];
		slow.checked = Boolean(Number(fields[1]));
		speed.value = Number(fields[2]);
		ia.checked = Boolean(Number(fields[3]));
		input.value = fields[4];
	}
	codearea.oninput();
	slow.oninput();
	ia.oninput();
	input.oninput();
}

function resize(elem) {
	elem.style.height = 0
	elem.style.height = elem.scrollHeight+'px';
}

window.onload = init;
