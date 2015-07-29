#include <stdio.h>

int main() {
	int result = 0;
	int n = 0;
	for (n = 0; n < 20000; n++) result += n * 1000;
	printf("%d\n", result);
	return 0;
}
