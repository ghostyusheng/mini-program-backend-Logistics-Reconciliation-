grep -rl 'http://127\.0\.0\.1:8000' src   | xargs -r sed -i 's#http://127\.0\.0\.1:8000#/api#g'
