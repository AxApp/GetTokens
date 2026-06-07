#ifndef GETTOKENS_MENUBAR_BRIDGE_H
#define GETTOKENS_MENUBAR_BRIDGE_H

#include <stddef.h>

void GetTokensMenuBarStart(const char *statusText, const char *displayName);
void GetTokensMenuBarStop(void);
void GetTokensMenuBarSetStatus(const char *statusText);
void GetTokensMenuBarSetQuotaSnapshot(const char *snapshotJSON);
void GetTokensMenuBarSetIcon(const unsigned char *data, size_t length);

#endif
