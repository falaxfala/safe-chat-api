import User from './User';
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
    ManyToOne
} from 'typeorm';

@Entity()
@Unique(['expiredToken'])
class ExpiredAccessToken {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    expiredToken: string;

    @Column()
    @CreateDateColumn()
    createdAt: Date;

    @Column()
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(type => User, user => user.expiredTokens)
    user: User;
}

export default ExpiredAccessToken;