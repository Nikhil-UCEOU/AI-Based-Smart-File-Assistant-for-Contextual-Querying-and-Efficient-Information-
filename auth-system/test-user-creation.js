require('dotenv').config();

const User = require('./server/models/User');
const database = require('./server/config/database');

async function testUserCreation() {
  console.log('🧪 Testing complete user creation with Pinecone...');
  
  try {
    // Connect to database
    await database.connect();
    console.log('✅ Database connected');
    
    // Create a test user
    const userData = {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@example.com',
      password: 'securePassword123'
    };
    
    console.log('👤 Creating user:', userData.firstName, userData.lastName);
    const user = await User.create(userData);
    
    console.log('✅ User created successfully!');
    console.log('📊 User details:');
    console.log('   Database ID:', user.id);
    console.log('   Pinecone ID:', user.pineconeId);
    console.log('   User Index:', user.userIndex);
    console.log('   Email:', user.email);
    
    // Test the JSON output (what the API returns)
    const userJson = user.toJSON();
    console.log('\n📤 API Response format:');
    console.log('   Main ID (Pinecone):', userJson.id);
    console.log('   Database ID:', userJson.databaseId);
    console.log('   Pinecone ID:', userJson.pineconeId);
    console.log('   User Index:', userJson.userIndex);
    
    // Test finding user by Pinecone ID
    const foundUser = await User.findByPineconeId(user.pineconeId);
    if (foundUser) {
      console.log('✅ User found by Pinecone ID');
    } else {
      console.log('❌ User not found by Pinecone ID');
    }
    
    console.log('\n🎉 User creation test completed successfully!');
    console.log('💡 The dashboard will now show the Pinecone ID as the main user ID');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.message.includes('Email already exists')) {
      console.log('💡 Test user already exists, this is expected if you ran the test before');
    }
  } finally {
    await database.close();
  }
}

testUserCreation();