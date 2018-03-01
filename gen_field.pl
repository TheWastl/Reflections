#!/usr/bin/perl -w

use List::Util qw(max reduce);

my $dir = $0;
$dir =~ s~/[^/]*$~~; #/# VI colouring doesn't understand s~~~ - wants s///;
open my $read, '<', "$dir/field" or die $!;
open my $write, '>', "$dir/field.js" or die $!;

my $i = 0;
my $line;
my $num_args = '';
my @map = ([], [], [], []);
my ($type, $x, $y);

print $write "const ";

while($line = <$read>) {
	if ($line =~
	  /^\s*\[([-+]?\d+)\|([-+]?\d+)\]\s*([A-Za-z0-9_]+)\s*\((\d+)\)\s$/) {
		print $write 'F_'.uc($3)."=$i,";
		if ($i) { $num_args .= ','; }
		$num_args .= $4;
		$type = 0;
		if ($1 >= 0) {
			$x = $1;
		} else {
			$type++;
			$x = -$1 -1;
		}
		if ($2 >= 0) {
			$y = $2;
		} else {
			$type += 2;
			$y = -$2 -1;
		}
		push @{$map[$type]}, [] while (@{$map[$type]} <= $y);
		push @{$map[$type][$y]}, [ -1, '' ]
		  while (@{$map[$type][$y]} <= $x);
		if ($map[$type][$y][$x][0] != -1) {
			print "Redeclaration of [$1|$2]\n";
			exit 1;
		}
		$map[$type][$y][$x] = [ $i, $3 ];
		$i++;
	}
}

close $read;
print $write "num_args=[$num_args],field=".map_to_js(@map).';';
close $write;

sub map_to_js {
	my @val = @_;
	if (!@val or ref $val[0] eq 'ARRAY') {
		my $res = '';
		foreach my $tmp (@val) {
			if ($res) { $res .= ','; }
			$res .= map_to_js(@$tmp);
		}
		return "[$res]";
#		return '['.join(',', map { map_to_js(@_) } @val).']';
	} else {
		return $val[0];
	}
}

open my $doc, '>', "$dir/field.html" or die $!;

print $doc '<!doctype html><html><head><title>Functions</title><style>'.
	'.zero{outline:1px solid red}table{text-align:center}</style>'.
	'<script src="field_addons.js"></script></head><body><table>';

my $maxx = get_maxx(0, 2);
my $minx = get_maxx(1, 3);

my $maxy = max scalar(@{$map[0]}), scalar(@{$map[1]});
my $miny = max scalar(@{$map[2]}), scalar(@{$map[3]});

print $doc '<col>'x($minx+1)."<col id='zero' class='zero'>".'<col>'x($maxx-1);

print $doc '<tr><th>Functions</th>';
foreach my $val (-$minx..$maxx-1) {
	print $doc "<th>$val</th>";
}
print $doc '</tr>';

foreach my $row ($miny..1) {
	show_row(2, $row-1, -$row);
}

foreach my $row (0..$maxy-1) {
	show_row(0, $row, $row);
}

print $doc '</table></body></html>';

sub get_maxx {
	my @list = ();
	foreach my $tmp (@map[@_]) {
		push @list, @$tmp;
	}
	return 0 if (!@list);
	return scalar @{(reduce { @$a > @$b ? $a : $b } @list)};
}

sub show_row {
	my $type = shift;
	my $row = shift;
	my $n = shift;
	my $zero = shift;
	print $doc '<tr';
	print $doc " class='zero'" if (!$n);
	print $doc "><th>$n</th>";
	my $fill = 0;
	$fill = @{$map[$type+1][$row]} if (@{$map[$type+1]} > $row);
	print $doc '<td></td>' x ($minx - $fill);
	if ($fill) {
		foreach my $f (reverse @{$map[$type+1][$row]}) {
			print $doc "<td>".$f->[1]."</td>";
		}
	}
	if (@{$map[$type]} > $row) {
		foreach my $f (@{$map[$type][$row]}) {
			print $doc "<td>".$f->[1]."</td>";
		}
	}
	print $doc '</tr>';
}
