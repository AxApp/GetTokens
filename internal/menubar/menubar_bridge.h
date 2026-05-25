#ifndef GETTOKENS_MENUBAR_BRIDGE_H
#define GETTOKENS_MENUBAR_BRIDGE_H

#include <stddef.h>

void GetTokensMenuBarStart(const char *statusText);
void GetTokensMenuBarStop(void);
void GetTokensMenuBarSetStatus(const char *statusText);
void GetTokensMenuBarSetIcon(const unsigned char *data, size_t length);

#endif
