local luaunit = require('luaunit')

require 'lua.redis_script_wrapper'

TestRedis = {}
function TestRedis:setUp()
    redis.call('FLUSHDB')
end

function TestRedis:testEmpty()
    value = call_redis_script('lua/match.lua', {"search_pool_5", 1450, 1550, "me"}, {})
    luaunit.assertEquals(value, false)
end

function TestRedis:testSinglePlayer()
    redis.call('ZADD', "search_pool_5", 1550, "me")
    value = call_redis_script('lua/match.lua', {"search_pool_5", 1450, 1550, "me"}, {})
    luaunit.assertEquals(value, true)
end

function TestRedis:testSingleOpponent()
    redis.call('ZADD', "search_pool_5", 1550, "me")
    redis.call('ZADD', "search_pool_5", 1500, "opponent")
    value = call_redis_script('lua/match.lua', {"search_pool_5", 1450, 1550, "me"}, {})
    luaunit.assertEquals(value, "opponent")
end

function TestRedis:tearDown()
    redis.call('FLUSHDB')
end

os.exit( luaunit.LuaUnit.run() )