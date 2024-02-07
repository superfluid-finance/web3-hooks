#!/bin/bash

# updates the remote deployment and restarts the service.
# operates through ssh, requires you to have access.

REMOTE="web3-hooks@main.x.superfluid.dev"

ssh $REMOTE <<EOF
. .nvm/nvm.sh
cd web3-hooks
git pull
yarn install
cd ..
systemctl --user restart web3-hooks.service
sleep 5
systemctl --user status web3-hooks --no-pager
EOF