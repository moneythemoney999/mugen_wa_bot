debug1: OpenSSH_10.3p1, OpenSSL 3.6.1 27 Jan 2026
debug1: Reading configuration data /data/data/com.termux/files/usr/etc/ssh/ssh_config
debug1: /data/data/com.termux/files/usr/etc/ssh/ssh_config line 20: include /data/data/com.termux/files/usr/etc/ssh/ssh_config.d/*.conf matched no files
debug1: Authenticator provider $SSH_SK_PROVIDER did not resolve; disabling
debug1: Connecting to 186.105.126.226 [186.105.126.226] port 9999.
debug1: Connection established.
debug1: no pubkey loaded from /data/data/com.termux/files/home/.ssh/id_rsa
debug1: identity file /data/data/com.termux/files/home/.ssh/id_rsa type -1
debug1: no identity pubkey loaded from /data/data/com.termux/files/home/.ssh/id_rsa
debug1: no pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ecdsa
debug1: identity file /data/data/com.termux/files/home/.ssh/id_ecdsa type -1
debug1: no identity pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ecdsa
debug1: no pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ecdsa_sk
debug1: identity file /data/data/com.termux/files/home/.ssh/id_ecdsa_sk type -1
debug1: no identity pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ecdsa_sk
debug1: no pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ed25519
debug1: identity file /data/data/com.termux/files/home/.ssh/id_ed25519 type -1
debug1: no identity pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ed25519
debug1: no pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ed25519_sk
debug1: identity file /data/data/com.termux/files/home/.ssh/id_ed25519_sk type -1
debug1: no identity pubkey loaded from /data/data/com.termux/files/home/.ssh/id_ed25519_sk
debug1: Local version string SSH-2.0-OpenSSH_10.3
debug1: Remote protocol version 2.0, remote software version OpenSSH_9.6p1 Ubuntu-3ubuntu13.15
debug1: compat_banner: match: OpenSSH_9.6p1 Ubuntu-3ubuntu13.15 pat OpenSSH* compat 0x04000000
debug1: Authenticating to 186.105.126.226:9999 as 'mugen999'
debug1: load_hostkeys: fopen /data/data/com.termux/files/home/.ssh/known_hosts2: No such file or directory
debug1: load_hostkeys: fopen /data/data/com.termux/files/usr/etc/ssh/ssh_known_hosts: No such file or directory
debug1: load_hostkeys: fopen /data/data/com.termux/files/usr/etc/ssh/ssh_known_hosts2: No such file or directory
debug1: SSH2_MSG_KEXINIT sent
debug1: SSH2_MSG_KEXINIT received
debug1: kex: algorithm: sntrup761x25519-sha512@openssh.com
debug1: kex: host key algorithm: ssh-ed25519
debug1: kex: server->client cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
debug1: kex: client->server cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
debug1: expecting SSH2_MSG_KEX_ECDH_REPLY
debug1: SSH2_MSG_KEX_ECDH_REPLY received
debug1: Server host key: ssh-ed25519 SHA256:rNv/kQjX/8N5KgjrVUCXrhhZZYN9keHvccgijYoREzk
debug1: load_hostkeys: fopen /data/data/com.termux/files/home/.ssh/known_hosts2: No such file or directory
debug1: load_hostkeys: fopen /data/data/com.termux/files/usr/etc/ssh/ssh_known_hosts: No such file or directory
debug1: load_hostkeys: fopen /data/data/com.termux/files/usr/etc/ssh/ssh_known_hosts2: No such file or directory
debug1: Host '[186.105.126.226]:9999' is known and matches the ED25519 host key.
debug1: Found key in /data/data/com.termux/files/home/.ssh/known_hosts:1
debug1: ssh_packet_send2_wrapped: resetting send seqnr 3
debug1: rekey out after 134217728 blocks
debug1: SSH2_MSG_NEWKEYS sent
debug1: Sending SSH2_MSG_EXT_INFO
debug1: expecting SSH2_MSG_NEWKEYS
debug1: ssh_packet_read_poll2: resetting read seqnr 3
debug1: SSH2_MSG_NEWKEYS received
debug1: rekey in after 134217728 blocks
debug1: SSH2_MSG_EXT_INFO received
debug1: kex_ext_info_client_parse: server-sig-algs=<ssh-ed25519,ecdsa-sha2-nistp256,ecdsa-sha2-nistp384,ecdsa-sha2-nistp521,sk-ssh-ed25519@openssh.com,sk-ecdsa-sha2-nistp256@openssh.com,rsa-sha2-512,rsa-sha2-256>
debug1: kex_ext_info_check_ver: publickey-hostbound@openssh.com=<0>
debug1: kex_ext_info_check_ver: ping@openssh.com=<0>
debug1: SSH2_MSG_SERVICE_ACCEPT received
debug1: SSH2_MSG_EXT_INFO received
debug1: kex_ext_info_client_parse: server-sig-algs=<ssh-ed25519,ecdsa-sha2-nistp256,ecdsa-sha2-nistp384,ecdsa-sha2-nistp521,sk-ssh-ed25519@openssh.com,sk-ecdsa-sha2-nistp256@openssh.com,rsa-sha2-512,rsa-sha2-256>
debug1: Authentications that can continue: publickey,password
debug1: Next authentication method: publickey
debug1: Will attempt key: /data/data/com.termux/files/home/.ssh/id_rsa 
debug1: Will attempt key: /data/data/com.termux/files/home/.ssh/id_ecdsa 
debug1: Will attempt key: /data/data/com.termux/files/home/.ssh/id_ecdsa_sk 
debug1: Will attempt key: /data/data/com.termux/files/home/.ssh/id_ed25519 
debug1: Will attempt key: /data/data/com.termux/files/home/.ssh/id_ed25519_sk 
debug1: Trying private key: /data/data/com.termux/files/home/.ssh/id_rsa
debug1: Trying private key: /data/data/com.termux/files/home/.ssh/id_ecdsa
debug1: Trying private key: /data/data/com.termux/files/home/.ssh/id_ecdsa_sk
debug1: Trying private key: /data/data/com.termux/files/home/.ssh/id_ed25519
debug1: Trying private key: /data/data/com.termux/files/home/.ssh/id_ed25519_sk
debug1: Next authentication method: password
debug1: Authentications that can continue: publickey,password
Permission denied, please try again.
debug1: Authentications that can continue: publickey,password
Permission denied, please try again.
debug1: Authentications that can continue: publickey,password
debug1: No more authentication methods to try.
mugen999@186.105.126.226: Permission denied (publickey,password).
